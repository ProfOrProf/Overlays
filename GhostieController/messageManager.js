const controlCodes = {
  UPDATE_CUSTOM_SKIN: 'UPDATE_CUSTOM_SKIN'
};

const isValidOrigin = (origin) => {
  const originUrl = new URL(origin);
  const allowedHostnames = [
    /^localhost$/,
    /^app\.gpv\.gg$/,
    /^gamepadviewer\.com$/,
    /^beta\.gamepadviewer\.com$/,
    /^overlay\.gamepadviewer\.com$/,
    /^gamepaddisplay\.com$/,
    /^stg\.gamepaddisplay\.com$/,
    /^([^.]+?\.)*frontend-staging-d1j\.pages\.dev$/,
    /^([^.]+?\.)*frontend-3qc\.pages\.dev$/
  ];

  const isAllowedOrigin = allowedHostnames.some((h) => h.test(originUrl.hostname));

  return isAllowedOrigin;
};

const isValidMessage = (message) => {
  const validations = {
    'Version Check': message.version && typeof message.version === 'number',
    'Data Check': message.data !== undefined, // We want to allow falsy values here
    'Command Check': message.command && Object.keys(controlCodes).includes(message.command)
  };

  const isValid = Object.keys(validations).every((check) => validations[check]);

  if (!isValid) {
    console.error('Message is invalid.', validations);
  }

  return isValid;
};

const handleMessage = (data) => {
  if (!isValidMessage(data)) return;

  const { UPDATE_CUSTOM_SKIN } = controlCodes;

  switch (data.command) {
    case UPDATE_CUSTOM_SKIN:
      const { css } = data.data;
      $('#gamepads .controller')
        /** Thanks to my bad practicies when originally writing the site,
         * this is accessible as a global variable.
         */
        .removeClass(skinSwitch)
        .addClass('custom');
      $('#css-preview').html(css);
      break;
  }
};

$(function () {
  window.addEventListener('message', (event) => {
    if (!isValidOrigin(event.origin)) return;

    handleMessage(event.data);
  });

  if (window.parent.location && isValidOrigin(document.referrer)) {
    window.parent.postMessage({ command: 'PREVIEW_READY' }, new URL(document.referrer).origin);
  }
});
