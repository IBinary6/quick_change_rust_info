export function cleanEmptyValues(obj: any): any {
  if (obj === null || obj === undefined || obj === "") return undefined;
  if (Array.isArray(obj)) {
    const cleaned = obj.filter((v: any) => v !== null && v !== undefined && v !== "");
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const value = cleanEmptyValues(obj[key]);
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return obj;
}
