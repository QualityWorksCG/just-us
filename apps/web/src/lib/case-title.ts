/**
 * The case title's length cap.
 *
 * The cap lives here because three places have to agree on it: the wizard and the
 * manage-case editor both count down against it while typing, and the server
 * schemas reject anything past it. A client that let someone write more than the
 * server accepts would fail the save after the words were written, which is the
 * worst moment to find out. A title is a headline, not a paragraph.
 */
export const CASE_TITLE_MAX = 100;

export const CASE_TITLE_TOO_LONG = `Keep your title under ${CASE_TITLE_MAX} characters.`;
