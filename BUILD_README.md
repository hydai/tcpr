# Build Configuration Guide

This project supports embedding Twitch Client ID and Client Secret into the application at build time, so end users don't need to manually configure these credentials.

## Features

- Read `.secret` file during build and embed credentials into the application
- Users don't need to manually enter Client ID and Client Secret
- Manual configuration option is still available (user config overrides builtin)
- `.secret` file is excluded from version control

## Usage

### 1. Create .secret File

Copy the example file and fill in your actual credentials:

```bash
cp .secret.example .secret
```

Edit the `.secret` file and fill in your credentials from [Twitch Developer Console](https://dev.twitch.tv/console/apps):

```
TWITCH_CLIENT_ID=your_actual_client_id
TWITCH_CLIENT_SECRET=your_actual_client_secret
```

### 2. Build the Application

Run the build command, and the prebuild script will automatically read the `.secret` file:

```bash
# Build both Windows and macOS versions
npm run build

# Build Windows version only
npm run build:win

# Build macOS version only
npm run build:mac
```

### 3. Build Process

During the build, the following steps occur:

1. The `prebuild` script reads the `.secret` file
2. Validates that Client ID and Secret exist and are not placeholders
3. Generates `config/builtin.js` file containing the embedded credentials
4. electron-builder packages the application with the builtin config

### 4. User Experience

When end users run the built application:

- The app automatically loads the builtin Client ID and Secret
- Users only need to complete the OAuth authorization flow
- Users can still manually override these values in settings if needed

## How It Works

### File Descriptions

- `.secret.example` - Template file showing what needs to be configured
- `.secret` - Actual credentials file (not committed to Git)
- `scripts/prebuild.js` - Pre-build script that reads `.secret` and generates config
- `config/builtin.js` - Auto-generated builtin configuration file

### Configuration Priority

The application loads configuration in the following priority order:

1. Builtin config (from `.secret` build) as the base
2. User's `.env` file config overrides builtin config
3. Empty values do not override existing config

### Security Considerations

**Gitignore Protection:**
- ✅ `.secret` file is added to `.gitignore` and won't be committed
- ✅ `config/builtin.js` is added to `.gitignore` to prevent accidental commits with embedded credentials

**Understanding the Security Model:**
- ⚠️ Credentials are intentionally embedded in the built application for distribution
- ⚠️ The built application (in `dist/`) will contain the embedded Client ID and Secret
- ⚠️ Anyone with access to the built application can extract these credentials using decompilation tools
- ⚠️ This approach is suitable when you want to distribute a pre-configured app to end users

**When to Use This Feature:**
- ✅ Distributing the app to end users who shouldn't see or manage credentials
- ✅ Creating branded versions of the app for specific Twitch applications
- ✅ Simplifying the setup process for non-technical users

**When NOT to Use This Feature:**
- ❌ Open source projects where the repository is public
- ❌ Distributing to untrusted parties who might abuse the credentials
- ❌ When you need to keep the Client Secret truly confidential

**Best Practices:**
- Keep your `.secret` file secure and never commit it
- Consider the credentials "public" once embedded in a distributed application
- Use Twitch's redirect URI whitelist to limit where OAuth can redirect
- Monitor your Twitch application for unusual activity
- Rotate credentials if they are compromised

## Building Without .secret File

If the `.secret` file doesn't exist, the build will still succeed, but will:

- Display warning messages
- Generate empty builtin config
- Require users to manually configure Client ID and Secret

## Troubleshooting

### Build Failed: Missing Credentials

```
Error: .secret file must contain TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET
```

**Solution**: Check that your `.secret` file contains both required fields.

### Build Failed: Placeholder Values

```
Warning: .secret file contains placeholder values.
Please update .secret with your actual credentials.
```

**Solution**: Replace `your_client_id_here` and `your_client_secret_here` with actual credentials.

### App Starts But Still Asks for Credentials

**Possible Causes**:
1. No `.secret` file existed during build
2. `.secret` file content is incorrect
3. `config/builtin.js` was not packaged correctly

**Solutions**:
1. Confirm `.secret` file exists with correct content
2. Re-run `npm run prebuild` and check the output
3. Check `config/builtin.js` file content
4. Rebuild the application

## Example Workflow

```bash
# 1. Set up credentials
cp .secret.example .secret
# Edit .secret and fill in actual credentials

# 2. Test prebuild script
npm run prebuild

# 3. Check generated config
cat config/builtin.js

# 4. Build the application
npm run build:win  # or build:mac

# 5. Test the built application
# Check the app in the dist/ directory
```

## Development Mode

In development mode (`npm run gui:dev`), the application still uses the `.env` file for configuration and does not use the builtin config. This allows developers to test different credentials without rebuilding.
