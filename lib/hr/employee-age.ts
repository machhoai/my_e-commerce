/** Returns the employee's completed age on the supplied local calendar date. */
export function getAgeFromDob(dob: string | undefined, today = new Date()): number | null {
    if (!dob) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    if (
        parsed.getFullYear() !== year
        || parsed.getMonth() !== month - 1
        || parsed.getDate() !== day
    ) return null;

    let age = today.getFullYear() - year;
    const birthdayHasPassed = today.getMonth() + 1 > month
        || (today.getMonth() + 1 === month && today.getDate() >= day);
    if (!birthdayHasPassed) age -= 1;
    return age >= 0 ? age : null;
}

export function isEmployeeUnder18(dob: string | undefined, today = new Date()): boolean {
    const age = getAgeFromDob(dob, today);
    return age !== null && age < 18;
}

