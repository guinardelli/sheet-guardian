# Security Policy

## Reporting a Vulnerability

We take the security of Sheet Guardian seriously. If you discover a security vulnerability, please report it to us responsibly.

### How to Report

**Email**: security@sheetguardian.com

Please include in your report:
- Description of the vulnerability
- Detailed steps to reproduce the issue
- Potential impact and severity
- Your contact information (optional, but helpful for follow-up)
- Any proof-of-concept code (if applicable)

### What to Expect

- **Response Time**: We will acknowledge receipt of your report within 48 hours
- **Updates**: We will keep you informed about our progress in addressing the issue
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days
- **Credit**: With your permission, we will publicly acknowledge your responsible disclosure

### Please DO NOT

- Publicly disclose the vulnerability before we've had a chance to address it
- Exploit the vulnerability beyond what is necessary to demonstrate it
- Access, modify, or delete data belonging to other users
- Perform any attacks that could harm the availability of our services

## Security Measures

### Current Implementations

#### Authentication & Authorization
- ✅ Strong password requirements (min 8 chars, uppercase, lowercase, numbers, special chars)
- ✅ Password strength indicator for user feedback
- ✅ Secure password reset flow (prevents email enumeration)
- ✅ Session management via Supabase Auth
- ✅ Row Level Security (RLS) policies on all database tables

#### Rate Limiting
- ✅ Database-level rate limiting infrastructure
- ✅ Tracks login, signup, and password reset attempts
- ✅ IP-based rate limiting (5 attempts per 15 minutes)
- ✅ Automatic cleanup of old rate limit records

#### File Upload Security
- ✅ File type validation (.xlsm only)
- ✅ File size limits (50 MB hard limit)
- ✅ Large file warnings (>10 MB)
- ✅ Client-side file validation before upload
- ⚠️  Server-side validation needed (Phase 2)

#### Data Protection
- ✅ Environment variables secured (.env removed from git)
- ✅ Secrets management via .env.example template
- ✅ HTTPS enforcement (deployment platform level)
- ✅ Secure headers (X-Frame-Options, CSP, etc.)

#### Subscription & Business Logic
- ⚠️  Client-side enforcement only (needs backend - Phase 2)
- ✅ Usage tracking and limits per plan
- ✅ Subscription state management

### Known Limitations (To Be Addressed)

#### Phase 2 Improvements Needed:
1. **Backend API Layer** - Currently all business logic is client-side
2. **Server-side file processing** - Move to backend with proper sandboxing
3. **Payment security** - Currently mock implementation
4. **Enhanced monitoring** - Error tracking (Sentry) and analytics
5. **API rate limiting** - Implement rate limiting at API layer
6. **CSRF protection** - Add CSRF tokens for state-changing operations
7. **Content scanning** - Malware/virus scanning for uploaded files

## Security Headers

We implement the following security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [detailed policy - see vercel.json]
```

## Data Privacy

- **Processing**: Files are processed client-side in the browser (no upload to server)
- **Storage**: User data stored securely in Supabase with encryption at rest
- **Retention**: Processed files are not stored (downloaded directly by user)
- **Compliance**: Working towards LGPD/GDPR compliance

## Authentication Flow Security

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

### Session Security
- Sessions managed by Supabase Auth
- Auto-refresh tokens enabled
- Secure cookie handling
- Session persistence via localStorage (with encryption)

### Password Reset
- Secure token-based reset
- Time-limited reset links
- No email enumeration (always shows success)
- Confirmation required for password change

## Database Security

### Row Level Security (RLS)
All database tables have RLS policies enforcing:
- Users can only access their own data
- No cross-user data leakage
- Enforced at database level (not bypassable from client)

### Rate Limiting Tables
```sql
-- Auth attempts tracking
public.auth_attempts
- Tracks all auth attempts by IP
- Automatic cleanup after 30 days
- Indexed for fast lookups
```

## File Processing Security

### Current Measures
1. **File type validation** - Only .xlsm accepted
2. **Size limits** - 50 MB maximum, warnings at 10 MB
3. **Client-side processing** - Files never leave user's browser
4. **Memory management** - Large files handled with care

### Future Improvements (Phase 2)
1. **Server-side processing** - Move to backend with sandboxing
2. **Malware scanning** - Integrate virus/malware detection
3. **Rate limiting** - Per-user processing limits enforced server-side
4. **Audit logging** - Track all file processing operations

## Vulnerability Disclosure Timeline

We follow responsible disclosure practices:

1. **Day 0**: Vulnerability reported
2. **Day 1-2**: Initial assessment and acknowledgment
3. **Day 3-7**: Detailed investigation and fix development
4. **Day 7-30**: Testing and deployment of fix
5. **Day 30+**: Public disclosure (if appropriate)

## Security Update Policy

- **Critical vulnerabilities**: Patched within 24-48 hours
- **High severity**: Patched within 7 days
- **Medium severity**: Patched within 30 days
- **Low severity**: Included in next regular release

## Bug Bounty Program

We currently do not have a formal bug bounty program, but we:
- Appreciate and acknowledge all responsible disclosures
- Provide public credit (with permission)
- Consider rewards on a case-by-case basis for significant findings

## Security Contacts

- **General Security**: security@sheetguardian.com
- **Privacy Questions**: privacy@sheetguardian.com
- **Emergency Contact**: Use email with subject "URGENT SECURITY"

## Compliance

We are working towards compliance with:
- **LGPD** (Lei Geral de Proteção de Dados - Brazil)
- **GDPR** (General Data Protection Regulation - EU)
- **SOC 2 Type II** (Future goal)

## Security Changelog

### 2025-12-10
- ✅ Implemented strong password requirements
- ✅ Added password strength indicator
- ✅ Removed .env from git repository
- ✅ Added rate limiting infrastructure
- ✅ Implemented email enumeration protection
- ✅ Added security headers configuration
- ✅ Implemented file size validation
- ✅ Created security.txt file
- ✅ Added comprehensive security constants

### Upcoming (Phase 2)
- ⏳ Backend API layer with authentication
- ⏳ Server-side file processing
- ⏳ Error monitoring and logging
- ⏳ Payment integration security
- ⏳ Enhanced rate limiting

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Documentation](https://supabase.com/docs/guides/auth/security)
- [React Security Best Practices](https://react.dev/learn/security)

---

**Last Updated**: 2025-12-10
**Version**: 1.0.0
**Contact**: security@sheetguardian.com
