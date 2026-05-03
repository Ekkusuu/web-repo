import jwt from 'jsonwebtoken'

const JWT_SECRET = 'lab7-demo-secret'
const JWT_EXPIRES_IN_SECONDS = 60

const ROLE_PERMISSIONS = {
  VISITOR: ['READ'],
  WRITER: ['READ', 'WRITE'],
  ADMIN: ['READ', 'WRITE', 'DELETE'],
}

export function issueToken({ role = 'VISITOR', permissions }) {
  const normalizedRole = ROLE_PERMISSIONS[role] ? role : 'VISITOR'
  const normalizedPermissions = normalizePermissions(permissions, normalizedRole)
  const payload = {
    role: normalizedRole,
    permissions: normalizedPermissions,
  }

  return {
    token: jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS }),
    expiresIn: JWT_EXPIRES_IN_SECONDS,
    ...payload,
  }
}

export function authenticateToken(request, response, next) {
  const authorization = request.headers.authorization || ''
  const [, token] = authorization.split(' ')

  if (!token) {
    response.status(401).json({ message: 'missing_bearer_token' })
    return
  }

  try {
    request.auth = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    response.status(401).json({ message: 'invalid_or_expired_token' })
  }
}

export function authorizePermissions(...expectedPermissions) {
  return (request, response, next) => {
    const userPermissions = request.auth?.permissions || []
    const allowed = expectedPermissions.every((permission) => userPermissions.includes(permission))

    if (!allowed) {
      response.status(403).json({ message: 'insufficient_permissions' })
      return
    }

    next()
  }
}

function normalizePermissions(permissions, role) {
  if (!Array.isArray(permissions) || !permissions.length) {
    return ROLE_PERMISSIONS[role]
  }

  const allowedPermissions = ['READ', 'WRITE', 'DELETE']
  const uniquePermissions = Array.from(new Set(permissions.map((permission) => String(permission).toUpperCase())))
  return uniquePermissions.filter((permission) => allowedPermissions.includes(permission))
}
