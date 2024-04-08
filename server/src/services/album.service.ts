import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { AccessCore, Permission } from 'src/cores/access.core';
import { FeatureFlag, SystemConfigCore } from 'src/cores/system-config.core';
import {
  AddUsersDto,
  AlbumCountResponseDto,
  AlbumInfoDto,
  AlbumResponseDto,
  CreateAlbumDto,
  GetAlbumsDto,
  UpdateAlbumDto,
  mapAlbum,
  mapAlbumWithAssets,
  mapAlbumWithoutAssets,
} from 'src/dtos/album.dto';
import { BulkIdResponseDto, BulkIdsDto } from 'src/dtos/asset-ids.response.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { AlbumEntity } from 'src/entities/album.entity';
import { AssetEntity } from 'src/entities/asset.entity';
import { UserEntity } from 'src/entities/user.entity';
import { IAccessRepository } from 'src/interfaces/access.interface';
import { AlbumAssetCount, AlbumInfoOptions, IAlbumRepository } from 'src/interfaces/album.interface';
import { IAssetRepository } from 'src/interfaces/asset.interface';
import { IEntityJob, IJobRepository, JobStatus, QueueName } from 'src/interfaces/job.interface';
import { IMachineLearningRepository } from 'src/interfaces/machine-learning.interface';
import { AssetSearchOptions, ISearchRepository, SmartSearchOptions } from 'src/interfaces/search.interface';
import { ISystemConfigRepository } from 'src/interfaces/system-config.interface';
import { IUserRepository } from 'src/interfaces/user.interface';
import { addAssets, removeAssets } from 'src/utils/asset.util';

@Injectable()
export class AlbumService {
  private access: AccessCore;
  private configCore: SystemConfigCore;

  constructor(
    @Inject(IAccessRepository) private accessRepository: IAccessRepository,
    @Inject(IAlbumRepository) private albumRepository: IAlbumRepository,
    @Inject(IAssetRepository) private assetRepository: IAssetRepository,
    @Inject(IUserRepository) private userRepository: IUserRepository,
    @Inject(IJobRepository) private jobRepository: IJobRepository,
    @Inject(ISystemConfigRepository) configRepository: ISystemConfigRepository,
    @Inject(IMachineLearningRepository) private machineLearning: IMachineLearningRepository,
    @Inject(ISearchRepository) private searchRepository: ISearchRepository,
  ) {
    this.access = AccessCore.create(accessRepository);
    this.configCore = SystemConfigCore.create(configRepository);
  }

  async getCount(auth: AuthDto): Promise<AlbumCountResponseDto> {
    const [owned, shared, notShared] = await Promise.all([
      this.albumRepository.getOwned(auth.user.id),
      this.albumRepository.getShared(auth.user.id),
      this.albumRepository.getNotShared(auth.user.id),
    ]);

    return {
      owned: owned.length,
      shared: shared.length,
      notShared: notShared.length,
    };
  }

  async getAll({ user: { id: ownerId } }: AuthDto, { assetId, shared }: GetAlbumsDto): Promise<AlbumResponseDto[]> {
    const invalidAlbumIds = await this.albumRepository.getInvalidThumbnail();
    for (const albumId of invalidAlbumIds) {
      const newThumbnail = await this.assetRepository.getFirstAssetForAlbumId(albumId);
      await this.albumRepository.update({ id: albumId, albumThumbnailAsset: newThumbnail });
    }

    let albums: AlbumEntity[];
    if (assetId) {
      albums = await this.albumRepository.getByAssetId(ownerId, assetId);
    } else if (shared === true) {
      albums = await this.albumRepository.getShared(ownerId);
    } else if (shared === false) {
      albums = await this.albumRepository.getNotShared(ownerId);
    } else {
      albums = await this.albumRepository.getOwned(ownerId);
    }

    // Get asset count for each album. Then map the result to an object:
    // { [albumId]: assetCount }
    const results = await this.albumRepository.getMetadataForIds(albums.map((album) => album.id));
    const albumMetadata: Record<string, AlbumAssetCount> = {};
    for (const metadata of results) {
      const { albumId, assetCount, startDate, endDate } = metadata;
      albumMetadata[albumId] = {
        albumId,
        assetCount,
        startDate,
        endDate,
      };
    }

    return Promise.all(
      albums.map(async (album) => {
        const lastModifiedAsset = await this.assetRepository.getLastUpdatedAssetForAlbumId(album.id);
        return {
          ...mapAlbumWithoutAssets(album),
          sharedLinks: undefined,
          startDate: albumMetadata[album.id].startDate,
          endDate: albumMetadata[album.id].endDate,
          assetCount: albumMetadata[album.id].assetCount,
          lastModifiedAssetTimestamp: lastModifiedAsset?.fileModifiedAt,
          smartSearch: album.smartSearch,
        };
      }),
    );
  }

  async get(auth: AuthDto, id: string, dto: AlbumInfoDto): Promise<AlbumResponseDto> {
    await this.access.requirePermission(auth, Permission.ALBUM_READ, id);
    await this.albumRepository.updateThumbnails();
    const withAssets = dto.withoutAssets === undefined ? true : !dto.withoutAssets;
    const album = await this.findOrFail(id, { withAssets });
    const [albumMetadataForIds] = await this.albumRepository.getMetadataForIds([album.id]);

    return {
      ...mapAlbum(album, withAssets, auth),
      startDate: albumMetadataForIds.startDate,
      endDate: albumMetadataForIds.endDate,
      assetCount: albumMetadataForIds.assetCount,
    };
  }

  async create(auth: AuthDto, dto: CreateAlbumDto): Promise<AlbumResponseDto> {
    for (const userId of dto.sharedWithUserIds || []) {
      const exists = await this.userRepository.get(userId, {});
      if (!exists) {
        throw new BadRequestException('User not found');
      }
    }

    const album = await this.albumRepository.create({
      ownerId: auth.user.id,
      albumName: dto.albumName,
      description: dto.description,
      sharedUsers: dto.sharedWithUserIds?.map((value) => ({ id: value }) as UserEntity) ?? [],
      assets: (dto.assetIds || []).map((id) => ({ id }) as AssetEntity),
      albumThumbnailAssetId: dto.assetIds?.[0] || null,
      smartSearch: {
        ...dto.smartSearch,
        persons: dto.smartSearch?.personIds.map((id: string) => ({ id })),
      },
    });

    return mapAlbumWithAssets(album);
  }

  async update(auth: AuthDto, id: string, dto: UpdateAlbumDto): Promise<AlbumResponseDto> {
    await this.access.requirePermission(auth, Permission.ALBUM_UPDATE, id);

    const album = await this.findOrFail(id, { withAssets: true });

    if (dto.albumThumbnailAssetId) {
      const valid = await this.albumRepository.hasAsset({ albumId: id, assetId: dto.albumThumbnailAssetId });
      if (!valid) {
        throw new BadRequestException('Invalid album thumbnail');
      }
    }
    const updatedAlbum = await this.albumRepository.update({
      id: album.id,
      albumName: dto.albumName,
      description: dto.description,
      albumThumbnailAssetId: dto.albumThumbnailAssetId,
      isActivityEnabled: dto.isActivityEnabled,
      order: dto.order,
    });

    return mapAlbumWithoutAssets(updatedAlbum);
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    await this.access.requirePermission(auth, Permission.ALBUM_DELETE, id);

    const album = await this.findOrFail(id, { withAssets: false });

    await this.albumRepository.delete(album);
  }

  async addAssets(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    const album = await this.findOrFail(id, { withAssets: false });
    await this.access.requirePermission(auth, Permission.ALBUM_READ, id);

    const results = await addAssets(
      auth,
      { accessRepository: this.accessRepository, repository: this.albumRepository },
      { id, assetIds: dto.ids },
    );

    const { id: firstNewAssetId } = results.find(({ success }) => success) || {};
    if (firstNewAssetId) {
      await this.albumRepository.update({
        id,
        updatedAt: new Date(),
        albumThumbnailAssetId: album.albumThumbnailAssetId ?? firstNewAssetId,
      });
    }

    return results;
  }

  async removeAssets(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    const album = await this.findOrFail(id, { withAssets: false });

    await this.access.requirePermission(auth, Permission.ALBUM_READ, id);

    const results = await removeAssets(
      auth,
      { accessRepository: this.accessRepository, repository: this.albumRepository },
      { id, assetIds: dto.ids, permissions: [Permission.ASSET_SHARE, Permission.ALBUM_REMOVE_ASSET] },
    );

    const removedIds = results.filter(({ success }) => success).map(({ id }) => id);
    if (removedIds.length > 0) {
      await this.albumRepository.update({ id, updatedAt: new Date() });
      if (album.albumThumbnailAssetId && removedIds.includes(album.albumThumbnailAssetId)) {
        await this.albumRepository.updateThumbnails();
      }
    }

    return results;
  }

  async addUsers(auth: AuthDto, id: string, dto: AddUsersDto): Promise<AlbumResponseDto> {
    await this.access.requirePermission(auth, Permission.ALBUM_SHARE, id);

    const album = await this.findOrFail(id, { withAssets: false });

    for (const userId of dto.sharedUserIds) {
      if (album.ownerId === userId) {
        throw new BadRequestException('Cannot be shared with owner');
      }

      const exists = album.sharedUsers.find((user) => user.id === userId);
      if (exists) {
        throw new BadRequestException('User already added');
      }

      const user = await this.userRepository.get(userId, {});
      if (!user) {
        throw new BadRequestException('User not found');
      }

      album.sharedUsers.push({ id: userId } as UserEntity);
    }

    return this.albumRepository
      .update({
        id: album.id,
        updatedAt: new Date(),
        sharedUsers: album.sharedUsers,
      })
      .then(mapAlbumWithoutAssets);
  }

  async removeUser(auth: AuthDto, id: string, userId: string | 'me'): Promise<void> {
    if (userId === 'me') {
      userId = auth.user.id;
    }

    const album = await this.findOrFail(id, { withAssets: false });

    if (album.ownerId === userId) {
      throw new BadRequestException('Cannot remove album owner');
    }

    const exists = album.sharedUsers.find((user) => user.id === userId);
    if (!exists) {
      throw new BadRequestException('Album not shared with user');
    }

    // non-admin can remove themselves
    if (auth.user.id !== userId) {
      await this.access.requirePermission(auth, Permission.ALBUM_SHARE, id);
    }

    await this.albumRepository.update({
      id: album.id,
      updatedAt: new Date(),
      sharedUsers: album.sharedUsers.filter((user) => user.id !== userId),
    });
  }

  private async findOrFail(id: string, options: AlbumInfoOptions) {
    const album = await this.albumRepository.getById(id, options);
    if (!album) {
      throw new BadRequestException('Album not found');
    }
    return album;
  }

  async handleSmartAlbumsUpdate(data: IEntityJob) {
    await this.jobRepository.waitForQueueCompletion(
      QueueName.FACE_DETECTION,
      QueueName.FACIAL_RECOGNITION,
      QueueName.METADATA_EXTRACTION,
    );

    const { id: assetId = '' } = data;
    const asset = await this.assetRepository.getById(assetId);

    const { ownerId: assetOwnerId = '', faces: assetFaces = [] } = { ...asset };
    const albums = await this.albumRepository.getSmartOwned(assetOwnerId);

    await Promise.all(
      albums.map(async (album) => {
        await this.configCore.requireFeature(FeatureFlag.SMART_SEARCH);
        const { machineLearning } = await this.configCore.getConfig();
        const userIds = [album.ownerId];

        const smartSearchQuery = album.smartSearch?.query;

        let newAssets: AssetEntity[] = [];
        if (smartSearchQuery) {
          const embedding = await this.machineLearning.encodeText(
            machineLearning.url,
            { text: album.smartSearch?.query || '' },
            machineLearning.clip,
          );

          const page = album.smartSearch?.page ?? 1;
          const size = album.smartSearch?.size || 100;
          const { items } = await this.searchRepository.searchSmart({ page, size }, {
            personIds: album.smartSearch?.persons?.map(({ id }) => id),
            userIds,
            embedding,
          } as SmartSearchOptions);
          newAssets = items;
        }

        if (!smartSearchQuery) {
          const userIds = [album.ownerId];

          const page = album.smartSearch?.page ?? 1;
          const size = album.smartSearch?.size || 250;
          const { items } = await this.searchRepository.searchMetadata({ page, size }, {
            personIds: album.smartSearch?.persons?.map(({ id }) => id),
            userIds,
            orderDirection: 'DESC',
          } as AssetSearchOptions);
          newAssets = items;
        }

        await this.albumRepository.addAssetIds(
          album.id,
          newAssets.filter((asset) => !album.assets.map(({ id }) => id).includes(asset.id)).map(({ id }) => id),
        );
      }),
    );

    return JobStatus.SUCCESS;
  }
}
