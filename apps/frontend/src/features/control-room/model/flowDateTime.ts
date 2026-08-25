export function toLocalDateTimeValue(iso: string): string {
    const date = new Date(iso);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function defaultFlowStartValue(): string {
    const date = new Date();
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
    return toLocalDateTimeValue(date.toISOString());
}

export function localDateTimeToIso(value: string): string {
    return new Date(value).toISOString();
}
