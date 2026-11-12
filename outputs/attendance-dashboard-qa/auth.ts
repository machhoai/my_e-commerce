const user = { uid: 'qa-employee' };
const hasPermission = () => true;
const getToken = async () => 'qa-token';
export function useAuth() { return { user, loading: false, hasPermission, getToken, effectiveStoreId: 'qa-store' }; }
