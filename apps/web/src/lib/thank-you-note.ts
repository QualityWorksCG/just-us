/**
 * The plaintiff's thank-you note, carried into every donor acknowledgement.
 *
 * The cap lives here because three places have to agree on it: the wizard and the
 * manage-case editor both count down against it while typing, and the server
 * schemas reject past it. A client that let someone write more than the server
 * accepts would fail the save after the words were written, which is the worst
 * moment to find out. It is email copy, not an essay.
 */
export const THANK_YOU_MAX = 600;

export const THANK_YOU_TOO_LONG = `Keep your thank-you under ${THANK_YOU_MAX} characters.`;
