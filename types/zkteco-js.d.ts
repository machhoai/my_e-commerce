// Type declarations for zkteco-js (untyped CommonJS module)
// Only the methods we use in the explore API are declared here.
declare module 'zkteco-js' {
  class Zkteco {
    constructor(ip: string, port: number, timeout?: number, inactivityTimeout?: number);

    createSocket(): Promise<void>;
    disconnect(): Promise<void>;

    getInfo(): Promise<Record<string, unknown>>;
    getUsers(): Promise<{ data: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>;
    getAttendances(): Promise<{ data: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>;

    getDeviceName(): Promise<string>;
    getDeviceVersion(): Promise<string>;
    getTime(): Promise<string>;
    getVendor(): Promise<string>;
    getPlatform(): Promise<string>;
    getOS(): Promise<string>;
    getSerialNumber?(): Promise<string>;
    getMacAddress(): Promise<string>;
    getPIN(): Promise<string>;
    getSSR(): Promise<string>;
    getFaceOn(): Promise<string>;
    getAttendanceSize(): Promise<number>;
    getProductTime?(): Promise<string>;

    getRealTimeLogs(callback: (log: Record<string, unknown>) => void): Promise<void>;
    clearAttendanceLog(): Promise<void>;
  }

  export default Zkteco;
}
