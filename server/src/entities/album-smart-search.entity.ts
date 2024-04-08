import { PersonEntity } from 'src/entities/person.entity';
import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('albums_smart_search')
export class AlbumSmartSearchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column({ type: 'varchar', nullable: true })
  libraryId?: string;

  @Column({ type: 'varchar', nullable: true })
  deviceId?: string;

  @Column({ type: 'varchar', nullable: true })
  type?: string;

  @Column({ type: 'boolean', nullable: true })
  isArchived?: boolean;

  @Column({ type: 'boolean', nullable: true })
  withArchived?: boolean;

  @Column({ type: 'boolean', nullable: true })
  isEncoded?: boolean;

  @Column({ type: 'boolean', nullable: true })
  isExternal?: boolean;

  @Column({ type: 'boolean', nullable: true })
  isFavorite?: boolean;

  @Column({ type: 'boolean', nullable: true })
  isMotion?: boolean;

  @Column({ type: 'boolean', nullable: true })
  isOffline?: boolean;

  @Column({ type: 'boolean', nullable: true })
  isReadOnly?: boolean;

  @Column({ type: 'boolean', nullable: true })
  isVisible?: boolean;

  @Column({ type: 'boolean', nullable: true })
  withDeleted?: boolean;

  @Column({ type: 'boolean', nullable: true })
  withExif?: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  createdBefore?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  createdAfter?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  updatedBefore?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  updatedAfter?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  trashedBefore?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  trashedAfter?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  takenBefore?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  takenAfter?: Date;

  @Column({ type: 'varchar', nullable: true })
  city?: string;

  @Column({ type: 'varchar', nullable: true })
  state?: string;

  @Column({ type: 'varchar', nullable: true })
  country?: string;

  @Column({ type: 'varchar', nullable: true })
  make?: string;

  @Column({ type: 'varchar', nullable: true })
  model?: string;

  @Column({ type: 'varchar', nullable: true })
  lensModel?: string;

  @Column({ type: 'smallint', nullable: true })
  page?: number;

  @Column({ type: 'integer', nullable: true })
  size?: number;

  @Column({ type: 'boolean', nullable: true })
  isNotInAlbum?: boolean;

  @ManyToMany(() => PersonEntity, { cascade: true })
  @JoinTable({
    joinColumn: {
      name: 'albumSmartSearchId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'personId',
      referencedColumnName: 'id',
    },
  })
  persons?: PersonEntity[];

  @Column({ type: 'varchar', nullable: true })
  query!: string;
}
