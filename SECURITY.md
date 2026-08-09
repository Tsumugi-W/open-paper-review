# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to the maintainers (see repository contact)
3. Include a description of the vulnerability, steps to reproduce, and potential impact
4. Allow reasonable time for a fix before public disclosure

## Security Considerations

### Prompt Injection

This system processes untrusted PDF content that may contain adversarial inputs. Defenses include:

- Four-layer injection detection (pattern scan, visual anomalies, OCR discrepancy, LLM classifier)
- Strict boundary markers between trusted instructions and untrusted paper content
- Suspicious content is sanitized before entering agent context
- Paper content never overwrites system prompts or agent roles

### File Processing

- Upload size and page limits enforced
- SSRF protection on arXiv downloads (private network blocking, redirect limits)
- PDF parsing in isolated contexts
- File hash verification for integrity

### Authentication

- Passwords hashed with PBKDF2 via crypto.subtle
- Secure httpOnly session cookies
- API tokens stored as hashes only
- Admin-only access for sensitive operations

### Data Handling

- Model provider API keys stored encrypted
- Structured logs exclude paper content
- Provider temporary files cleaned up on all exit paths
- Cascade deletion removes all derived artifacts

## Supported Versions

Only the latest release receives security updates.
