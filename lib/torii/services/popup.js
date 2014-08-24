import ParseQueryString from 'torii/lib/parse-query-string';
import {supportLocationPolling} from 'torii/configuration';

// For < IE11
window.postMessageWithFix = function postMessageWithFix(str, domain) {
  setTimeout(function(){
    window.postMessage(str, domain);
  }, 0);
};

function stringifyOptions(options){
  var optionsStrings = [];
  for (var key in options) {
    if (options.hasOwnProperty(key)) {
      var value;
      switch (options[key]) {
        case true:
          value = '1';
          break;
        case false:
          value = '0';
          break;
        default:
          value = options[key];
      }
      optionsStrings.push(
        key+"="+value
      );
    }
  }
  return optionsStrings.join(',');
}

function prepareOptions(options){
  var width = options.width || 500,
      height = options.height || 500;
  return Ember.$.extend({
    left: ((screen.width / 2) - (width / 2)),
    top: ((screen.height / 2) - (height / 2)),
    width: width,
    height: height
  }, options);
}

var messagePrefix = '__torii_message:';

function validateToriiMessage(message){
  return message && message.indexOf(messagePrefix) === 0;
}

function parseMessage(message, keys){
  var url = message.slice(messagePrefix.length),
      parser = new ParseQueryString(url, keys),
      data = parser.parse();
  return data;
}

function findLocation(popup){
  popup = popup || false;
  return new Ember.RSVP.Promise(function(resolve, reject){
    if (!popup || !popup.window) {
      return reject(new Error('unable to access window or no popup specified'));
    }
    if (popup.window.location && popup.window.location.href){
      return resolve(popup.window.location.href);
    }
  });
}

var Popup = Ember.Object.extend(Ember.Evented, {

  // Open a popup window. Returns a promise that resolves or rejects
  // accoring to if the popup is redirected with arguments in the URL.
  //
  // For example, an OAuth2 request:
  //
  // popup.open('http://some-oauth.com', ['code']).then(function(data){
  //   // resolves with data.code, as from http://app.com?code=13124
  // });
  //
  open: function(url, keys, options){
    var service   = this,
        lastPopup = this.popup;

    var oldName = window.name;
    // Is checked by the popup to see if it was opened by Torii
    window.name = 'torii-opener';

    return new Ember.RSVP.Promise(function(resolve, reject){
      if (lastPopup) {
        service.close();
      }

      var optionsString = stringifyOptions(prepareOptions(options || {}));
      service.popup = window.open(url, 'torii-auth', optionsString);

      if (service.popup && !service.popup.closed) {
        service.popup.focus();
      } else {
        reject(new Error(
          'Popup could not open or was closed'));
        return;
      }

      service.one('didClose', function(){
        reject(new Error(
          'Popup was closed or authorization was denied'));
      });

      Ember.$(window).on('message.torii', function(event){
        var message = event.originalEvent.data;
        if (validateToriiMessage(message)) {
          var data = parseMessage(message, keys);
          resolve(data);
        }
      });

      service.schedulePolling();

    }).finally(function(){
      // didClose will reject this same promise, but it has already resolved.
      service.close();
      window.name = oldName;
      Ember.$(window).off('message.torii');
    });
  },

  close: function(){
    if (this.popup) {
      this.popup.close();
      this.popup = null;
      this.trigger('didClose');
    }
  },

  pollPopup: function(){
    if (!this.popup) {
      return;
    }
    if (this.popup.closed) {
      this.trigger('didClose');
    }
  },

  pollPopupLocation: function(){
    findLocation(this.popup).then(function(url){
      if ('about:blank' !== url) {
        var message = messagePrefix + url;
        window.postMessage(message, '*');
      }
    }).catch(function(error){
      // ignore SecurityErrors caused by same origin policy while popup is on provider's hostname.
      return;
    });
  },

  schedulePolling: function(){
    this.polling = Ember.run.later(this, function(){
      this.pollPopup();
      this.schedulePolling();
    }, 35);
  },

  stopPolling: function(){
    Ember.run.cancel(this.polling);
  }.on('didClose'),


});

if (supportLocationPolling()) {
  Popup.reopen({
    schedulePolling: function() {
      this.polling = Ember.run.later(this, function(){
        this.pollPopup();
        this.pollPopupLocation();
        this.schedulePolling();
      }, 35);
    }
  });
}

export default Popup;
