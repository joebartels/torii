var get = Ember.get;

var configuration       = get(window, 'ENV.torii') || {};
configuration.providers = configuration.providers || {};

function configurable(configKey, defaultValue){
  return Ember.computed(function(){
    var namespace = this.get('configNamespace'),
        fullKey   = namespace ? [namespace, configKey].join('.') : configKey,
        value     = get(configuration, fullKey);
    if (typeof value === 'undefined') {
      if (typeof defaultValue !== 'undefined') {
        if (typeof defaultValue === 'function') {
          return defaultValue.call(this);
        } else {
          return defaultValue;
        }
      } else {
        throw new Error("Expected configuration value "+fullKey+" to be defined!");
      }
    }
    return value;
  });
}

// inconsistent behavior with IE. enable location polling as fallback
// https://github.com/Vestorly/torii/issues/63
function supportLocationPolling() {
  var userAgent = window.navigator.userAgent,
      isIE = userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1;
  return configuration.supportLocationPolling || isIE;
}

export {configurable, supportLocationPolling};

export default configuration;
