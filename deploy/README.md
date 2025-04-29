# Deploy Resources

## Certificate Files (.pem)
The .pem files in this directory are **placeholder self-signed certificates** used only during initial installation. They:
- Are NEVER used in production environments
- Are automatically replaced by Let's Encrypt certificates during installation on real domains
- Only facilitate bootstrapping the installation process
- Contain no sensitive cryptographic material

These files allow the installer to set up a working HTTPS configuration before proper certificates are obtained. For security reasons, you should always obtain proper certificates for production deployments.
