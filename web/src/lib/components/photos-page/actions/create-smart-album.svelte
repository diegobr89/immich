<script lang="ts">
  import CircleIconButton from '$lib/components/elements/buttons/circle-icon-button.svelte';
  import { mdiImageSync } from '@mdi/js';
  import { getPerson, type AssetResponseDto, type SmartSearchDto } from '@immich/sdk';
  import { featureFlags } from '$lib/stores/server-config.store';
  import { addAssetsToNewAlbum } from '$lib/utils/asset-utils';

  export let assets: AssetResponseDto[];
  export let searchTerms: SmartSearchDto | undefined;

  async function getPersonName(personIds: string[]) {
    const personNames = await Promise.all(
      personIds.map(async (personId) => {
        const person = await getPerson({ id: personId });
        return person.name || 'Unknown';
      }),
    );

    return personNames.join(' and ');
  }

  const resolveAlbumTitle = async (terms?: SmartSearchDto) => {
    const persons = Array.isArray(terms?.personIds) ? await getPersonName(terms?.personIds) : '';
    const context = terms?.query || '';
    const type = (terms?.type || '')
      .toLowerCase()
      .replace(/^([A-z])(.*)/, (_match: unknown, p1: string, p2: string) => {
        return `${p1.toUpperCase()}${p2}s`;
      });
    const conditionalString = (value: string, text?: string) => (value.length > 0 ? ` ${text || value}` : '');

    const output = `${type}${conditionalString(type, ' of')}${conditionalString(persons)}${conditionalString(context)}`;

    return output.trim();
  };

  const handleCreateSmartAlbum = async (albumName: string = '') => {
    const assetIds = assets.map((asset) => asset.id);
    const resolvedAlbumName = albumName || (await resolveAlbumTitle(searchTerms));
    await addAssetsToNewAlbum(resolvedAlbumName, assetIds, searchTerms);
  };
</script>

{#if $featureFlags.smartSearch && assets.length > 0 && !!searchTerms}
  <CircleIconButton title="Create smart album" icon={mdiImageSync} on:click={() => handleCreateSmartAlbum()} />
{/if}
