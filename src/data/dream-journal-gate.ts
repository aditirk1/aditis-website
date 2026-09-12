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
		id: 'sport',
		question: 'What sport did I love playing all the time?',
		answerHashes: [
			'6382deaf1f5dc6e792b76db4a4a7bf2ba468884e000b25e7928e621e27fb23cb',
			'8f27f432fcbaa4b5180a1cc7a8fa166a93cda3c1bce6f19922dd519d02f4bb39',
		],
	},
	{
		id: 'first-cook',
		question: 'What was the first dish I ever learned to make? (one word)',
		answerHashes: [
			'46da674b5b0987431bdb496e4982fadcd400abac99e7a977b43f216a98127721',
			'34707c3f40dfa20c3902b807b627d420d6d474d9d98066ba637953d1cfd6b914',
		],
	},
	{
		id: 'mantra',
		question: "In one word, what's my mantra in life?",
		answerHashes: [
			'c2e10c20bf46daf0ba03f725218b012544a3d0d3b37334eeb1d4d81e5406e478',
			'2b4b2eadf7b2aece598d2f2ad4637361614a738a7cdf1a457d8b46db072184d5',
			'3b21278178ed3463f3bde3a35f088caf6d99ff1b2f647d9a0c2b8de599ec3dc6',
		],
	},
];

export const DREAM_JOURNAL_UNLOCK_KEY = 'aditi-dream-journal-unlocked';
export const DREAM_JOURNAL_QUESTION_KEY = 'aditi-dream-gate-question-id';
export const DREAM_JOURNAL_ATTEMPTS_KEY = 'aditi-dream-gate-attempts';
export const DREAM_JOURNAL_MAX_ATTEMPTS = 3;
