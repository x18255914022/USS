export function rankTeachers<T extends { available: boolean; teachesSubject: boolean }>(items: T[]) {
  return [...items].sort((a, b) => {
    const ar = (a.available ? 2 : 0) + (a.teachesSubject ? 1 : 0);
    const br = (b.available ? 2 : 0) + (b.teachesSubject ? 1 : 0);
    return br - ar;
  });
}

