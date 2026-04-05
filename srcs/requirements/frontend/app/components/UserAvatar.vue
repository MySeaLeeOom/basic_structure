<script setup lang="ts">
/**
 * UserAvatar - First Principles Visualization
 * 
 * Logic:
 * 1. If imageURL exists, use <img> tag.
 * 2. If imageURL is null/empty, generate a deterministic SVG using the UUID as seed.
 */

interface Props {
	uuid: string;
	imageURL?: string | null;
	size?: number;
}

// Safety net in case props are empty
const props = withDefaults(defineProps<Props>(), {
	imageURL: null,
	size: 40
});

// Deterministic hash for UUID -> Number
function hashCode(str: string) {
	if (!str) return 0;
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash) + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

// Seeded Random Helper
function mulberry32(a: number) {
	return function () {
		let t = a += 0x6D2B79F5;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}
}

const avatarSvg = computed(() => {
	const seed = hashCode(props.uuid || 'default');
	const rand = mulberry32(seed);

	// Deterministic palette properties
	const baseHu = Math.floor(rand() * 360);
	const identitySaturation = Math.floor(rand() * 75 + 20);
	const identityLightness = Math.floor(rand() * 55 + 30);

	// Harmonious Palette (Base, Complement, Analogous)
	const secondaryHu = (baseHu + 180) % 360;
	const tertiaryHu = (baseHu + 30) % 360;

	const palette = [
		`hsla(${baseHu}, ${identitySaturation}%, ${identityLightness}%, 0.9)`,
		`hsla(${secondaryHu}, ${identitySaturation}%, ${identityLightness}%, 0.9)`,
		`hsla(${tertiaryHu}, ${identitySaturation}%, ${identityLightness}%, 0.9)`
	];

	// Pick how many colors this specific ID gets
	const paletteRoll = rand();
	let selectedPalette;
	if (paletteRoll < 0.2) selectedPalette = palette;
	else if (paletteRoll < 0.7) selectedPalette = palette.slice(0, 2);
	else selectedPalette = palette.slice(0, 1);

	const gridSize = 5;
	const pixelSize = props.size / gridSize;

	let svg = `<svg width="${props.size}" height="${props.size}" viewBox="0 0 ${props.size} ${props.size}" xmlns="http://www.w3.org/2000/svg">`;
	// Background based on base hue
	svg += `<rect width="100%" height="100%" fill="hsl(${baseHu}, 15%, 97%)" />`;

	// Symmetrical Generation
	for (let x = 0; x < Math.ceil(gridSize / 2); x++) {
		for (let y = 0; y < gridSize; y++) {
			if (rand() > 0.42) {
				const color = selectedPalette[Math.floor(rand() * selectedPalette.length)];

				const rect = (px: number, py: number) =>
					`<rect x="${px * pixelSize}" y="${py * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${color}" />`;

				svg += rect(x, y);
				if (x < Math.floor(gridSize / 2)) {
					svg += rect(gridSize - 1 - x, y);
				}
			}
		}
	}
	svg += `</svg>`;
	return svg;
});
</script>

<template>
	<div class="user-avatar" :style="{ width: size + 'px', height: size + 'px' }">
		<!-- Case 1: External Image exists -->
		<img v-if="imageURL" :src="imageURL" class="avatar-img" />

		<!-- Case 2: Fallback to Generated Identity -->
		<div v-else v-html="avatarSvg" class="avatar-svg" />
	</div>
</template>

<style scoped>
.user-avatar {
	border-radius: 4px;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f0f0f0;
	border: 1px solid rgba(0, 0, 0, 0.05);
}

.avatar-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.avatar-svg {
	display: flex;
}
</style>
