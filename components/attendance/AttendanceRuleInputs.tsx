'use client';

const twoDigits = (value: number) => String(value).padStart(2, '0');
const selectClass = 'min-w-0 flex-1 bg-transparent py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 rounded-lg';
const groupClass = 'flex items-center gap-1 rounded-xl border border-surface-200 bg-white px-2';

/** Explicit segments keep the display independent of browser/OS locale. */
export function Time24Input({ value, onChange, label }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
}) {
    const [hour, minute] = value.split(':');
    return (
        <div role="group" aria-label={`${label} (24 giờ)`} className={groupClass}>
            <select aria-label={`${label}: giờ (00–23)`} value={hour}
                onChange={event => onChange(`${event.target.value}:${minute}`)} className={selectClass}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={twoDigits(i)}>{twoDigits(i)}</option>)}
            </select>
            <span aria-hidden="true">:</span>
            <select aria-label={`${label}: phút`} value={minute}
                onChange={event => onChange(`${hour}:${event.target.value}`)} className={selectClass}>
                {Array.from({ length: 60 }, (_, i) => <option key={i} value={twoDigits(i)}>{twoDigits(i)}</option>)}
            </select>
        </div>
    );
}

export function DateDmyInput({ value, onChange, label }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
}) {
    const [year = '', month = '', day = ''] = value.split('-');
    const maxDay = month ? new Date(Date.UTC(Number(year || 2000), Number(month), 0)).getUTCDate() : 31;
    const years = Array.from(new Set([
        ...Array.from({ length: 201 }, (_, i) => String(1900 + i)),
        ...(year ? [year] : []),
    ])).sort();
    const update = (nextYear: string, nextMonth: string, nextDay: string) => {
        const limit = nextMonth ? new Date(Date.UTC(Number(nextYear || 2000), Number(nextMonth), 0)).getUTCDate() : 31;
        const validDay = nextDay ? twoDigits(Math.min(Number(nextDay), limit)) : '';
        onChange(`${nextYear}-${nextMonth}-${validDay}`);
    };
    return (
        <div role="group" aria-label={`${label} (dd/mm/yyyy)`} className={`${groupClass} flex-1`}>
            <select aria-label={`${label}: ngày`} value={day} onChange={event => update(year, month, event.target.value)} className={selectClass}>
                <option value="">dd</option>
                {Array.from({ length: maxDay }, (_, i) => <option key={i} value={twoDigits(i + 1)}>{twoDigits(i + 1)}</option>)}
            </select>
            <span aria-hidden="true">/</span>
            <select aria-label={`${label}: tháng`} value={month} onChange={event => update(year, event.target.value, day)} className={selectClass}>
                <option value="">mm</option>
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={twoDigits(i + 1)}>{twoDigits(i + 1)}</option>)}
            </select>
            <span aria-hidden="true">/</span>
            <select aria-label={`${label}: năm`} value={year} onChange={event => update(event.target.value, month, day)} className={`${selectClass} grow-[1.4]`}>
                <option value="">yyyy</option>
                {years.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
        </div>
    );
}
