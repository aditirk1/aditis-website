/**
 * Dream journal gate — casual privacy, not cryptographic security.
 * Answers: case-insensitive; simple plurals match (egg ↔ eggs).
 */
export type DreamGateQuestion = {
	id: string;
	question: string;
	answers: string[];
};

export const DREAM_JOURNAL_GATE_QUESTIONS: DreamGateQuestion[] = [
	{
		id: 'first-flight',
		question: 'Where was my first flight to? (country, e.g. Germany)',
		answers: ['germany'],
	},
	{
		id: 'first-cook',
		question: 'What was the first thing I learnt to cook? (one word)',
		answers: ['eggs', 'egg'],
	},
	{
		id: 'birth-month',
		question: 'What month is my birthday in?',
		answers: ['september'],
	},
	{
		id: 'sport',
		question: 'What sport did I love playing?',
		answers: ['football', 'soccer'],
	},
	{
		id: 'ideal-weekend',
		question: 'Where am I on an ideal weekend? (one word)',
		answers: ['hike', 'swim', 'beach', 'outdoors'],
	},
];

export const DREAM_JOURNAL_UNLOCK_KEY = 'aditi-dream-journal-unlocked';
export const DREAM_JOURNAL_QUESTION_KEY = 'aditi-dream-gate-question-id';
