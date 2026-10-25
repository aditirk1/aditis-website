/**
 * Font pairs under consideration for the Portfolio theme (portfolio lab).
 *
 * Zodiak, Switzer and General Sans are loaded from Fontshare, under the ITF
 * Free Font License (free for commercial use, web embedding included).
 *
 * PP Editorial New, PP Neue Montreal (Pangram Pangram) and Roslindale Display
 * (David Jonathan Ross) are commercial. Nothing of theirs is copied or served:
 * the lab reads them with local() from a copy installed on the viewing Mac
 * (a trial is fine for evaluation), and otherwise falls back to the labelled
 * open-licence stand-in. Production needs a purchased webfont licence.
 */
export type TypeFace = {
	name: string;
	source: string;
	/** Family names as declared in styles/portfolio.css. */
	cssFamily: string;
	/** Set for commercial faces read from the viewer's installed fonts. */
	local?: { probe: string[]; standIn: string; getIt: string };
};

export type TypePair = {
	id: 'editorial' | 'roslindale' | 'zodiak';
	label: string;
	display: TypeFace;
	text: TypeFace;
};

export const typePairs: TypePair[] = [
	{
		id: 'editorial',
		label: 'PP Editorial New Light + PP Neue Montreal',
		display: {
			name: 'PP Editorial New',
			source: 'Pangram Pangram, commercial',
			cssFamily: 'PF Editorial New',
			local: {
				probe: ['PP Editorial New Ultralight', 'PPEditorialNew-Ultralight', 'PP Editorial New Light', 'PPEditorialNew-Light', 'PP Editorial New'],
				standIn: 'Newsreader',
				getIt: 'https://pangrampangram.com/products/editorial-new',
			},
		},
		text: {
			name: 'PP Neue Montreal',
			source: 'Pangram Pangram, commercial',
			cssFamily: 'PF Neue Montreal',
			local: {
				probe: ['PP Neue Montreal Book', 'PPNeueMontreal-Book', 'PP Neue Montreal Regular', 'PPNeueMontreal-Regular', 'PP Neue Montreal'],
				standIn: 'Hanken Grotesk',
				getIt: 'https://pangrampangram.com/products/neue-montreal',
			},
		},
	},
	{
		id: 'roslindale',
		label: 'Roslindale Display + General Sans',
		display: {
			name: 'Roslindale Display',
			source: 'David Jonathan Ross, commercial',
			cssFamily: 'PF Roslindale',
			local: {
				probe: ['Roslindale Display Light', 'RoslindaleDisplay-Light', 'Roslindale Display Light Trial', 'Roslindale Display'],
				standIn: 'Fraunces',
				getIt: 'https://djr.com/roslindale',
			},
		},
		text: {
			name: 'General Sans',
			source: 'Fontshare, ITF Free Font License',
			cssFamily: 'General Sans',
		},
	},
	{
		id: 'zodiak',
		label: 'Zodiak + Switzer',
		display: {
			name: 'Zodiak',
			source: 'Fontshare, ITF Free Font License',
			cssFamily: 'Zodiak',
		},
		text: {
			name: 'Switzer',
			source: 'Fontshare, ITF Free Font License',
			cssFamily: 'Switzer',
		},
	},
];

/** The only pair whose real faces every viewer sees. */
export const defaultTypePair: TypePair['id'] = 'zodiak';

export const FONTSHARE_CSS =
	'https://api.fontshare.com/v2/css?f[]=zodiak@300,301,400,401&f[]=switzer@300,400,500&f[]=general-sans@300,400,500&display=swap';

/** Open-licence stand-ins (Google Fonts, SIL OFL) for the commercial faces. */
export const STAND_IN_CSS =
	'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..500;1,6..72,200..500&family=Fraunces:ital,opsz,wght@0,9..144,200..500;1,9..144,200..500&family=Hanken+Grotesk:wght@300..600&display=swap';
