<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '@workspace/ui/globals.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
