/**
 * OAuth callback handler
 */

(function() {
    'use strict';

    /**
     * Initialize the OAuth callback handler
     */
    function init() {
        // Check for OAuth callback parameters
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (accessToken) {
            handleSuccess(accessToken);
        } else if (error) {
            handleError(error, errorDescription);
        }
    }

    /**
     * Handle successful OAuth authorization
     * @param {string} accessToken - The access token from OAuth
     */
    function handleSuccess(accessToken) {
        // Display success message
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.className = 'status-message success';
            statusDiv.textContent = 'Successfully authenticated with Twitch!';
        }

        // Display the token
        const tokenDisplay = document.getElementById('token-display');
        const tokenValue = document.getElementById('token-value');

        if (tokenValue) {
            tokenValue.textContent = accessToken;
        }

        if (tokenDisplay) {
            tokenDisplay.classList.add('show');
        }
    }

    /**
     * Handle OAuth authorization error
     * @param {string} error - Error code
     * @param {string} errorDescription - Error description
     */
    function handleError(error, errorDescription) {
        // Display error message
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.className = 'status-message error';
            statusDiv.textContent = `Error: ${error}${errorDescription ? ' - ' + errorDescription : ''}`;
        }
    }

    /**
     * Copy token to clipboard
     * @param {Event} event - Click event
     */
    window.copyToken = function(event) {
        const tokenValue = document.getElementById('token-value');
        if (!tokenValue) {
            return;
        }

        const token = tokenValue.textContent;

        navigator.clipboard.writeText(token)
            .then(() => {
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';

                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy token:', err);
                alert('Failed to copy token: ' + err);
            });
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
