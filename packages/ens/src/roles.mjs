// Role bitmaps (planning/SPEC/IDENTITY_ENS.md §3), checked against the verified sources of
// RegistryRolesLib, PermissionedResolverLib and EACBaseRolesLib (Sourcify, 2026-11-06). Each
// role is one nybble; its admin role is the same bit shifted up 128.

export const admin = (role) => role << 128n;

export const REGISTRY = Object.freeze({
  REGISTRAR: 1n << 0n,
  REGISTER_RESERVED: 1n << 4n,
  SET_PARENT: 1n << 8n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  CAN_TRANSFER_ADMIN: (1n << 28n) << 128n,
});

export const RESOLVER = Object.freeze({
  SET_ADDRESS: 1n << 0n,
  SET_TEXT: 1n << 4n,
  SET_CONTENTHASH: 1n << 8n,
  SET_ABI: 1n << 12n,
  SET_INTERFACE: 1n << 16n,
  SET_NAME: 1n << 20n,
  SET_DATA: 1n << 24n,
  LINK: 1n << 28n,
  UPGRADE: 1n << 124n,
});

// 64 nybbles of 1: every role and every admin role.
export const ALL_ROLES = BigInt(`0x${'1'.repeat(64)}`);

// OPERATOR on UR_root's root: registers and maintains the owners; never transfers or upgrades.
export const OPERATOR_ROOT_ROLES =
  REGISTRY.REGISTRAR | REGISTRY.RENEW | REGISTRY.UNREGISTER | REGISTRY.SET_PARENT | REGISTRY.SET_RESOLVER | REGISTRY.SET_SUBREGISTRY;

// OPERATOR on each owner registry's root: REGISTRAR only (it cannot unregister, renew or re-point).
export const OPERATOR_OWNER_REGISTRY_ROLES = REGISTRY.REGISTRAR;

// The owner on its own registry's root: kill (unregister) and renew its agents, with their admins.
export const OWNER_REGISTRY_ROOT_ROLES =
  REGISTRY.RENEW |
  admin(REGISTRY.RENEW) |
  REGISTRY.UNREGISTER |
  admin(REGISTRY.UNREGISTER) |
  REGISTRY.SET_PARENT |
  REGISTRY.SET_SUBREGISTRY |
  REGISTRY.SET_RESOLVER;

// The owner's token in UR_root: no CAN_TRANSFER_ADMIN, so the name is non-transferable.
export const NAME_OWNER_TOKEN_ROLES = REGISTRY.SET_SUBREGISTRY | REGISTRY.SET_RESOLVER | REGISTRY.RENEW;

// An agent's token: nothing (non-transferable, cannot renew, cannot re-point).
export const AGENT_TOKEN_ROLES = 0n;

// True if every bit of `roles` is a defined role bit (no stray bits outside the nybble pattern).
export const isRoleBitmap = (roles) => (roles & ~ALL_ROLES) === 0n;
