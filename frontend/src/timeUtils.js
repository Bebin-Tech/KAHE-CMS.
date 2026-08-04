const IST_TIME_ZONE = 'Asia/Kolkata';

const istParts = (date) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
};

export const toISTDateTimeLocal = (date) => {
    const parts = istParts(date);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const istNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: IST_TIME_ZONE }));

export const formatISTDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-IN', {
        timeZone: IST_TIME_ZONE,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

export const formatISTTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('en-IN', {
        timeZone: IST_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};
