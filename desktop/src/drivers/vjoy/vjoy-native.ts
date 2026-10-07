import koffi from 'koffi';

export function loadVJoyNative(path: string) {
  const library = koffi.load(path);
  try {
  const enabled = library.func('int32_t __cdecl vJoyEnabled()');
  const matches = library.func('int32_t __cdecl DriverMatch(_Out_ uint16_t *dll, _Out_ uint16_t *driver)');
  const exists = library.func('int32_t __cdecl isVJDExists(uint32_t id)');
  const status = library.func('int32_t __cdecl GetVJDStatus(uint32_t id)');
  const axisExists = library.func('int32_t __cdecl GetVJDAxisExist(uint32_t id, uint32_t axis)');
  const minimum = library.func('int32_t __cdecl GetVJDAxisMin(uint32_t id, uint32_t axis, _Out_ int32_t *value)');
  const maximum = library.func('int32_t __cdecl GetVJDAxisMax(uint32_t id, uint32_t axis, _Out_ int32_t *value)');
  const acquire = library.func('int32_t __cdecl AcquireVJD(uint32_t id)');
  const relinquish = library.func('void __cdecl RelinquishVJD(uint32_t id)');
  const setAxis = library.func('int32_t __cdecl SetAxis(int32_t value, uint32_t id, uint32_t axis)');
  const range = (id: number, axis: number): { min: number; max: number } => {
    const low = [0], high = [0];
    if (!minimum(id, axis, low) || !maximum(id, axis, high) || high[0] <= low[0]) throw new Error('Cannot read vJoy axis range.');
    return { min: low[0], max: high[0] };
  };
  return {
    enabled: (): boolean => Boolean(enabled()),
    matches: (): boolean => Boolean(matches([0], [0])),
    exists: (id: number): boolean => Boolean(exists(id)),
    status: (id: number): number => Number(status(id)),
    axisExists: (id: number, axis: number): boolean => Boolean(axisExists(id, axis)),
    range, acquire: (id: number): boolean => Boolean(acquire(id)),
    relinquish: (id: number): void => { relinquish(id); },
    setAxis: (value: number, id: number, axis: number): boolean => Boolean(setAxis(value, id, axis)),
    unload: (): void => library.unload()
  };
  } catch (error) { library.unload(); throw error; }
}
