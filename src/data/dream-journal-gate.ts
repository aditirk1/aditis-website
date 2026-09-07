/**
 * Dream journal gate — casual privacy, not cryptographic security.
 * Answers are stored as SHA-256 of the normalized lowercase form so plaintext
 * answers are not sitting in the client bundle. Dream HTML still ships in the
 * static build, so this is obfuscation against casual snooping only.
 */
export type DreamGateQuestion = {
	id: string;
	question: string;
	/** SHA-256 hex digests of normalizeAnswer(accepted) values */
	answerHashes: string[];
};

export const DREAM_JOURNAL_GATE_QUESTIONS: DreamGateQuestion[] = [
	{
		id: 'first-flight',
		question: 'Where was my first flight to? (country, e.g. Germany)',
		answerHashes: ['b2c01c8a8a0d9a99f145f099a963021f010dc608a8e992bd1a2aec958b48f32d'],
	},
	{
		id: 'first-cook',
		question: 'What was the first thing I learnt to cook? (one word)',
		answerHashes: [
			'46da674b5b0987431bdb496e4982fadcd400abac99e7a977b43f216a98127721',
			'34707c3f40dfa20c3902b807b627d420d6d474d9d98066ba637953d1cfd6b914',
		],
	},
	{
		id: 'birth-month',
		question: 'What month is my birthday in?',
		answerHashes: ['249d1f9cb846410c407c6569aa28ba7ac9f8cd6d95685ba6321a627fa0997db5'],
	},
	{
		id: 'sport',
		question: 'What sport did I love playing?',
		answerHashes: [
			'6382deaf1f5dc6e792b76db4a4a7bf2ba468884e000b25e7928e621e27fb23cb',
			'8f27f432fcbaa4b5180a1cc7a8fa166a93cda3c1bce6f19922dd519d02f4bb39',
		],
	},
	{
		id: 'ideal-weekend',
		question: 'Where am I on an ideal weekend? (one word)',
		answerHashes: [
			'c02d7803a91c395845d5c950120e0520f27d51869c8d56d1ca5ccb1eaf73465a',
			'd493f8869139bac710b992c1126f61b8bef4bbf2b00b4b3c047f243cbdd0555e',
			'ab36e84344729d2bc762ee67e55bb3ceb69fdcfd7585a792b220c2a7cd1e6c0d',
			'bc722fdb1dad80255de3e68cb0c0ea1ba1d7bed347edf0c57bd7fc65e9edb87f',
		],
	},
];

export const DREAM_JOURNAL_UNLOCK_KEY = 'aditi-dream-journal-unlocked';
export const DREAM_JOURNAL_QUESTION_KEY = 'aditi-dream-gate-question-id';
