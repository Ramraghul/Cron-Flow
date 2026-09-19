export type AuthMethod = 'jwt' | 'api-key';

/** The principal attached to `request.user` after JWT or API-key authentication. */
export interface AuthenticatedUser {
    id: string;
    email: string;
    authMethod: AuthMethod;
}
