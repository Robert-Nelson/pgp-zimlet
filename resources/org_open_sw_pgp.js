!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.orgopenswpgp=e():"undefined"!=typeof global?global.orgopenswpgp=e():"undefined"!=typeof self&&(self.orgopenswpgp=e())}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//"use strict";

/*

This file is responsible for all the Zimbra integration functions and everything
else that's done in the zimbra interface

TODO:
	=> Button that links to my Github
	=> Implement options via setUserProperty() and getUserProperty()

// List all properties in object
properties = appCtxt._zimletMgr._ZIMLETS_BY_ID['org_open_sw_pgp']._propsById
for(var i in properties) {
	if (properties.hasOwnProperty(i)) {
		console.log(i + " = " + properties[i].value);
	}
}


*/

var openpgp = require('openpgp');

/**
 * @external HTMLElement
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement
 */

/**
 * @external ajax.dwt.events
 */

/**
 * @class external:ajax.dwt.events.DwtSelectionEvent
 * @see http://files.zimbra.com/docs/zimlet/zcs/8.0.4/jsdocs/symbols/DwtSelectionEvent.html
 */

/**
 * @external zimbraMail.mail.model
 */

/**
 * @class external:zimbraMail.mail.model.ZmMailMsg
 * @see http://files.zimbra.com/docs/zimlet/zcs/8.0.4/jsdocs/symbols/ZmMailMsg.html
 */

/**
 * @class external:zimbraMail.mail.model.ZmMimePart
 * @see http://files.zimbra.com/docs/zimlet/zcs/8.0.4/jsdocs/symbols/ZmMimePart.html
 */

/**
 * @external zimbraMail.mail.view
 */

/**
 * @class external:zimbraMail.mail.view.ZmConvView2
 * @see http://files.zimbra.com/docs/zimlet/zcs/8.0.4/jsdocs/symbols/ZmConvView2.html
 */

/**
 * @class external:zimbraMail.mail.view.ZmMailMsgView
 * @see http://files.zimbra.com/docs/zimlet/zcs/8.0.4/jsdocs/symbols/ZmMailMsgView.html
 */

/**
 * @external zimbraMail.share.model
 */

/**
 * @class external:zimbraMail.share.model.ZmZimletBase
 * @see http://files.zimbra.com/docs/zimlet/zcs/8.0.4/jsdocs/symbols/ZmZimletBase.html
 */

/**
 * @typedef {Object} org_open_sw_pgp.messageContext
 * @property {string} divId - PGP-Zimlet info bar div id
 * @property {string} mailMsgId - Zimbra mail message id
 * @property {external:openpgp.cleartext} cleartext - Object representing the cleartext signed message
 * @property {external:openpgp.key[]} keyList - List of public keys used to sign message
 * @property {string[]} keyIdList - List of public key ids used to sign message
 */

/**
 * @constructor
 * @param {boolean} [testMode=false] - Set to true when operating under the test harness
 * @param {external:keyring} [keyring] - Keyring object
 */
org_open_sw_pgp = function (testMode, keyring) {
	this.testMode = testMode ? true : false;
	this.keyring = keyring ? keyring : require('keyring');
	openpgp.util.print_output = function (level, str) {
		if (!this.testMode) {
			var header = "UNKNOWN";
			switch (level) {
				case openpgp.util.printLevel.error:
					header = "ERROR";
					break;
				case openpgp.util.printLevel.warning:
					header = "WARNING";
					break;
				case openpgp.util.printLevel.info:
					header = "INFO";
					break;
				case openpgp.util.printLevel.debug:
					header = "DEBUG";
					break;
			}
			try {
				console.log(header + ': ' + str);
			} catch (e) {
			}
		}
	};
};

/** 
 * Build prototype with base constructor and objectHandler's constructor
 */
org_open_sw_pgp.prototype = new ZmZimletBase();
org_open_sw_pgp.prototype.constructor = org_open_sw_pgp;

/**
 * Return our class name
 * @return {string}
 */
org_open_sw_pgp.prototype.toString = function () {
	return "org_open_sw_pgp";
};

/** 
 * Initialize zimlet
 */
org_open_sw_pgp.prototype.init = function () {
	this.hasLocalStorage = typeof(window.localStorage) == "object";

    this._keyringTabAppName = this.createApp("PGP Keyring", "keyringTabIcon", "View and Change PGP Keyring");

	//openpgp.config.debug = true;
};

/**
 * Called by Zimbra when a new conversation is shown
 * @param {external:zimbraMail.mail.model.ZmMailMsg} msg - New message
 * @param {external:zimbraMail.mail.model.ZmMailMsg} oldMsg - Previous message
 * @param {external:zimbraMail.mail.view.ZmConvView2} view - Conversation view
*/
org_open_sw_pgp.prototype.onConvView = function (msg, oldMsg, view) {
	this._processMsg(msg, view);
};

/**
 * Called by Zimbra when a new mail message is shown
 * @param {external:zimbraMail.mail.model.ZmMailMsg} msg - New message
 * @param {external:zimbraMail.mail.model.ZmMailMsg} oldMsg - Previous message
 * @param {external:zimbraMail.mail.view.ZmMailMsgView} view - Mail message view
 */
org_open_sw_pgp.prototype.onMsgView = function (msg, oldMsg, view) {
	this._processMsg(msg, view);
};

/**
 * Process a new mail message
 * @param {external:zimbraMail.mail.model.ZmMailMsg} msg - New message
 * @param {external:zimbraMail.mail.view.ZmConvView2|external:zimbraMail.mail.view.ZmMailMsgView} view - Conversation or mail message view
 */
org_open_sw_pgp.prototype._processMsg = function (msg, view) {
	var elemId = view._htmlElId + '__PGP-Zimlet';

	var div = document.getElementById(elemId);

	if (div) {
		var html = this._getFromTempCache(msg.id);

		if (html) {
			// Make the bar visible
			div.innerHTML = html;
			return;
		}
	}

	// Get the plain text body
	msg.getBodyPart(ZmMimeTable.TEXT_PLAIN, AjxCallback.simpleClosure(this._processMsgCB, this, view, div, msg.id));
};

/**
 * Callback invoked with text/plain version of message
 * @callback org_open_sw_pgp._processMsgCB
 * @param {external:zimbraMail.mail.view.ZmConvView2|external:zimbraMail.mail.view.ZmMailMsgView} view - Conversation or mail message view
 * @param {external:HTMLElement} div - PGP-Zimlet info bar
 * @param {string} msgId - Zimbra message id
 * @param {external:zimbraMail.mail.model.ZmMimePart} bodyPart - MIME part with text/plain body
 */
org_open_sw_pgp.prototype._processMsgCB = function (view, div, msgId, bodyPart) {
	if (bodyPart) {
		var msgText = bodyPart.getContent();

		if (msgText.match(/^-----BEGIN (.*)-----$/m)) {
			if (!div) {
				var bodyDiv = document.getElementById(view._msgBodyDivId);

				div = document.createElement("div");
				div.id = view._htmlElId + '__PGP-Zimlet';
				div.className = 'pgpInfoBar';

				bodyDiv.parentElement.insertBefore(div, bodyDiv);

				div = document.getElementById(div.id);
			}

			var msgContext = { divId:div.id, mailMsgId: msgId };

			// Parse out our signature stuff and message text
			msgContext.cleartext = openpgp.cleartext.readArmored(msgText);

			if (msgContext.cleartext) {
				this._displayVerifyBar(msgContext);
			} else {
				this._displayResultBar(msgContext, false, 'unknown', 'unknown', 'Error parsing message');
			}

			if (this.testMode) {
				this._searchForKey(msgContext);
			}
		}
	}
};

/**
 * Searches cache for key, if not found, ask about going online
 * @param {org_open_sw_pgp.messageContext} msgContext - Context for processing Zimbra mail message
 */
org_open_sw_pgp.prototype._searchForKey = function (msgContext) {
	msgContext.keyList = [];
	msgContext.keyIdList = [];
	var keyIdList = msgContext.cleartext.getSigningKeyIds();
	for (var i = 0; i < keyIdList.length; i++) {
		var keyId = openpgp.util.hexstrdump(keyIdList[i].write());
		var publicKeyList = this.keyring.getKeysForKeyId(keyId);
		if (publicKeyList && publicKeyList.length > 0) {
			msgContext.keyList = msgContext.keyList.concat(publicKeyList);
		} else {
			msgContext.keyIdList.push(keyId);
		}
	}
	if (msgContext.keyList.length > 0) {
		// If this key is found in the cache
		this._msgVerify(msgContext);
	} else {
		if (!this.testMode) {
			// Otherwise, ask about going online
			var dialog = appCtxt.getYesNoMsgDialog(); 
			var errMsg = "Could not find public key in the cache, search pgp.mit.edu for it?";
			var style = DwtMessageDialog.INFO_STYLE;

			dialog.setButtonListener(DwtDialog.YES_BUTTON, new AjxListener(this, this._searchBtnListener, msgContext));
			dialog.setButtonListener(DwtDialog.NO_BUTTON, new AjxListener(this, this._dialogCloseListener));

			dialog.reset();
			dialog.setMessage(errMsg, style);
			dialog.popup();
		}
	}
};

/**
 * Event handler for search internet for key
 * @callback org_open_sw_pgp._searchBtnListener
 * @param {org_open_sw_pgp.messageContext} msgContext - Context for processing Zimbra mail message
 * @param {external:ajax.dwt.events.DwtSelectionEvent} eventobj - Ajax selection event object
 */
org_open_sw_pgp.prototype._searchBtnListener = function (msgContext, eventobj) {
	if (eventobj) {
		eventobj.item.parent.popdown();
	}

	var keyid = msgContext.keyIdList[0];
	var response = AjxRpc.invoke(null, '/service/zimlet/org_open_sw_pgp/lookup.jsp?key=0x'+keyid, null, null, true);
	// If we don't have a null response
	if (response.text !== "" && response.txt !== "No email specified") {
		// If the key was found, 
		// Create a new temporary div to populate with our response so we can navigate it easier, and hide it.
		var temp_div = document.createElement('div');
		temp_div.innerHTML = response.text;
		var keytext = temp_div.getElementsByTagName('pre')[0].innerHTML;
		this.keyring.importKey(keytext);
		this._msgVerify(msgContext);
	} else {
		// If no key was found, error out and display the problem. 
		// Will update so manual key entry is possible later. 
		var dialog = appCtxt.getYesNoMsgDialog(); 
		var errMsg = "Could not find the key on pgp.mit.edu, enter it manually?";
		var style = DwtMessageDialog.INFO_STYLE;

		dialog.setButtonListener(DwtDialog.YES_BUTTON, new AjxListener(this, _manualKeyEntry, msgContext));
		dialog.setButtonListener(DwtDialog.NO_BUTTON, new AjxListener(this, _dialogCloseListener));

		dialog.reset();
		dialog.setMessage(errMsg, style);
		dialog.popup();
	}
};

/**
 * Display dialog for manual key import
 * @callback org_open_sw_pgp._manualKeyEntry
 * @param {org_open_sw_pgp.messageContext} msgContext - Context for processing Zimbra mail message
 * @param {external:ajax.dwt.events.DwtSelectionEvent} eventobj - Ajax selection event object
 */
org_open_sw_pgp.prototype._manualKeyEntry = function (msgContext, eventobj) {
	eventobj.item.parent.popdown();

	var HTML =	'<div id="keyEntryDiv">' +
					'<textarea id="keyEntryTextarea"></textarea>' +
				'</div>';

	var sDialogTitle = "<center>Enter in the public key and press \"OK\"</center>";

	var view = new DwtComposite(appCtxt.getShell());
	view.setSize("500", "500"); 
	view.getHtmlElement().style.overflow = "auto";
	view.getHtmlElement().innerHTML = HTML;

	// pass the title, view & buttons information to create dialog box
	var dialog = new ZmDialog({title:sDialogTitle, view:view, parent:appCtxt.getShell(), standardButtons:[DwtDialog.OK_BUTTON]});
	dialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._readKeyListener, msgContext));
	dialog.popup();
};

/**
 * Event handler for import key
 * @callback org_open_sw_pgp._readKeyListener
 * @param {org_open_sw_pgp.messageContext} msgContext - Context for processing Zimbra mail message
 * @param {external:ajax.dwt.events.DwtSelectionEvent} eventobj - Ajax selection event object
 */
org_open_sw_pgp.prototype._readKeyListener = function (msgContext, eventobj) {
	eventobj.item.parent.popdown();

	// Get our key pasted in, and clear our the entry in the DOM
	var pgpKey = document.getElementById('keyEntryTextarea').value;
	document.getElementById('keyEntryTextarea').value = "";
	this.keyring.importKey(pgpKey);
	this._msgVerify(msgContext);
};

/**
 * Verify mail message signature
 * @param {org_open_sw_pgp.messageContext} msgContext - Context for processing Zimbra mail message
 */
org_open_sw_pgp.prototype._msgVerify = function (msgContext) {
	var index;

	if (msgContext.keyList.length === 0) {
		var keyIdList = msgContext.cleartext.getSigningKeyIds();
		for (index = 0; index < keyIdList.length; index++) {
			var publicKeyList = this.keyring.getKeysForKeyId(openpgp.util.hexstrdump(keyIdList[index].write()));
			if (publicKeyList !== null && publicKeyList.length > 0) {
				msgContext.keyList = msgContext.keyList.concat(publicKeyList);
			}
		}
	}

	var result = false;
	var id = "0x" + openpgp.util.hexstrdump(msgContext.keyList[0].getKeyIds()[0].write()).substring(8);
	var user = msgContext.keyList[0].getUserIds()[0];

	var verifyResult = msgContext.cleartext.verify(msgContext.keyList);
	if (verifyResult) {
		for (index = 0; index < verifyResult.length; index++) {
			if (verifyResult[index].valid) {
				result = true;
				id = "0x" + openpgp.util.hexstrdump(verifyResult[index].keyid.write()).substring(8);
				user = msgContext.keyList[index].getUserIds()[0];
				break;
			}
		}
	}

	this._displayResultBar(msgContext, result, id, user);
};

/**
 * Remove cached result html for previously verified message
 * @param {string} msgId - Zimbra mail message id
 */
org_open_sw_pgp.prototype._removeFromTempCache = function (msgId) {
	// If we have the necessary sessionStorage object
	if (this.hasLocalStorage) {
		sessionStorage.removeItem(msgId);
	} else {
		// By default cookies are all session
		document.cookie.removeItem('PGPVerified_' + msgId);
	}
};

/**
 * Store cached result html for previously verified message
 * @param {string} msgId - Zimbra mail message id
 */
org_open_sw_pgp.prototype._storeInTempCache = function (msgId, HTML) {
	// If we have the necessary sessionStorage object
	if (this.hasLocalStorage) {
		sessionStorage.setItem(msgId, escape(HTML));
	} else {
		// By default cookies are all session
		document.cookie = 'PGPVerified_' + msgId +'='+ escape(HTML);
	}
};

/**
 * Return cached result html for previously verified message
 * @param {string} msgId - Zimbra mail message id
 * @return {string} result html
 */
org_open_sw_pgp.prototype._getFromTempCache = function (msgId) {
	// If we have the necessary localStorage object
	if (this.hasLocalStorage) {
		msgHTML = sessionStorage.getItem(msgId);
		if (msgHTML !== null) {
			msgHTML = unescape(msgHTML);
		}
		return msgHTML;
	} else {
		var cookies = document.cookie.split(';');
		var pgpCookies = [];
		for (i=0;i<cookies.length;i++) {
			// Populate our pgpCookies array with the pointers to the cookies we want
			if (cookies[i].indexOf('PGPVerified_') != -1) {
				pgpCookies.push(i);
			}
		}
		// For each PGP cookie
		for (i=0;i<pgpCookies.length;i++) {     
			if (cookies[pgpCookies[i]].replace(/^\s/,'').split('=')[0] === "PGPVerified_" + msgId) {
				// Delicious cookies
				msgHTML = unescape(cookies[pgpCookies[i]].replace(/^\s/,'').split('=')[1]);
				return msgHTML;
			}
		}
		return null;
	}    
};

/**
 * Display bar indicating message signed
 * @param {org_open_sw_pgp.messageContext} msgContext - Context for processing Zimbra mail message
 */
org_open_sw_pgp.prototype._displayVerifyBar = function (msgContext) {
	var values = {
		logo: this.getResource('pgp.png'),
		infoBarDivId: msgContext.divId
	};
	var zimlet = this;
	var div = document.getElementById(msgContext.divId);

	div.innerHTML = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_verify", values);

	buttons = div.getElementsByClassName("verifyButton");
	buttons[0].onclick = function () { zimlet._searchForKey(msgContext); };

	buttons = div.getElementsByClassName("escapeButton");
	buttons[0].onclick = function () { zimlet._destroyInfoBar(msgContext); };
};

/**
 * Display signature verification result
 * @param {org_open_sw_pgp.messageContext} msgContext - Context for processing Zimbra mail message
 * @param {boolean} succeeded - True if signature verified
 * @param {string} keyId - Id of key used to verify message
 * @param {string} user - User which owns key used to verify message
 * @param {string} [msg] - Custom failure message
 */
org_open_sw_pgp.prototype._displayResultBar = function (msgContext, succeeded, keyId, user, msg) {
	user = user.replace('<','&lt;').replace('>','&gt;');

	if (!msg) {
		msg = succeeded ? 'verified successfully!' : '*NOT* verified!';
	}

	var values = {
		logo: this.getResource('pgp.png'),
		className: succeeded ? 'success' : 'fail',
		id: keyId,
		user: user,
		msg: msg,
		infoBarDivId: msgContext.divId
	};
	var zimlet = this;
	var div = document.getElementById(msgContext.divId);

	div.innerHTML = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_result", values);

	buttons = div.getElementsByClassName("escapeButton");
	buttons[0].onclick = function () { zimlet._destroyInfoBar(msgContext); };

	this._storeInTempCache(msgContext, div.innerHTML);
};

/**
 * Event handler for info bar close button
 * @callback org_open_sw_pgp._destroyInfoBar
 * @param {org_open_sw_pgp.messageContext} msgContext - Context for processing Zimbra mail message
*/
org_open_sw_pgp.prototype._destroyInfoBar = function (msgContext) {
	document.getElementById(msgContext.divId).innerHTML = "";
	this._removeFromTempCache(msgContext.mailMsgId);
};

/**
 * Event handler for close button
 * @callback org_open_sw_pgp._dialogCloseListener
 * @param {external:ajax.dwt.events.DwtSelectionEvent} eventobj - Ajax selection event object
 */
org_open_sw_pgp.prototype._dialogCloseListener = function (eventobj) {
	if (eventobj) {
		eventobj.item.parent.popdown();
	}
};
/**
 * This method gets called by the Zimlet framework when the application is opened for the first time.
 *
 * @param {String} appName - The application name
 */
org_open_sw_pgp.prototype.appLaunch = function(appName) {
	switch (appName) {
		case this._keyringTabAppName: {
			var app = appCtxt.getApp(appName); // get access to ZmZimletApp

			var content = this._createTabView();
			app.setContent(content); // write HTML to application tab

			break;
		}
	}
};

/**
 * Creates the tab view using the template.
 *
 * @return {String} The tab HTML content
 */
org_open_sw_pgp.prototype._createTabView = function() {
    return  AjxTemplate.expand("org_open_sw_pgp.templates.pgp#keyring_tab");
};

},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9yb2JlcnQvemltYnJhLXBncC9wZ3AtemltbGV0L3BncC16aW1sZXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIi8vXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKlxyXG5cclxuVGhpcyBmaWxlIGlzIHJlc3BvbnNpYmxlIGZvciBhbGwgdGhlIFppbWJyYSBpbnRlZ3JhdGlvbiBmdW5jdGlvbnMgYW5kIGV2ZXJ5dGhpbmdcclxuZWxzZSB0aGF0J3MgZG9uZSBpbiB0aGUgemltYnJhIGludGVyZmFjZVxyXG5cclxuVE9ETzpcclxuXHQ9PiBCdXR0b24gdGhhdCBsaW5rcyB0byBteSBHaXRodWJcclxuXHQ9PiBJbXBsZW1lbnQgb3B0aW9ucyB2aWEgc2V0VXNlclByb3BlcnR5KCkgYW5kIGdldFVzZXJQcm9wZXJ0eSgpXHJcblxyXG4vLyBMaXN0IGFsbCBwcm9wZXJ0aWVzIGluIG9iamVjdFxyXG5wcm9wZXJ0aWVzID0gYXBwQ3R4dC5femltbGV0TWdyLl9aSU1MRVRTX0JZX0lEWydvcmdfb3Blbl9zd19wZ3AnXS5fcHJvcHNCeUlkXHJcbmZvcih2YXIgaSBpbiBwcm9wZXJ0aWVzKSB7XHJcblx0aWYgKHByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcclxuXHRcdGNvbnNvbGUubG9nKGkgKyBcIiA9IFwiICsgcHJvcGVydGllc1tpXS52YWx1ZSk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuKi9cclxuXHJcbnZhciBvcGVucGdwID0gcmVxdWlyZSgnb3BlbnBncCcpO1xyXG5cclxuLyoqXHJcbiAqIEBleHRlcm5hbCBIVE1MRWxlbWVudFxyXG4gKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9IVE1MRWxlbWVudFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBAZXh0ZXJuYWwgYWpheC5kd3QuZXZlbnRzXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBjbGFzcyBleHRlcm5hbDphamF4LmR3dC5ldmVudHMuRHd0U2VsZWN0aW9uRXZlbnRcclxuICogQHNlZSBodHRwOi8vZmlsZXMuemltYnJhLmNvbS9kb2NzL3ppbWxldC96Y3MvOC4wLjQvanNkb2NzL3N5bWJvbHMvRHd0U2VsZWN0aW9uRXZlbnQuaHRtbFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBAZXh0ZXJuYWwgemltYnJhTWFpbC5tYWlsLm1vZGVsXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBjbGFzcyBleHRlcm5hbDp6aW1icmFNYWlsLm1haWwubW9kZWwuWm1NYWlsTXNnXHJcbiAqIEBzZWUgaHR0cDovL2ZpbGVzLnppbWJyYS5jb20vZG9jcy96aW1sZXQvemNzLzguMC40L2pzZG9jcy9zeW1ib2xzL1ptTWFpbE1zZy5odG1sXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBjbGFzcyBleHRlcm5hbDp6aW1icmFNYWlsLm1haWwubW9kZWwuWm1NaW1lUGFydFxyXG4gKiBAc2VlIGh0dHA6Ly9maWxlcy56aW1icmEuY29tL2RvY3MvemltbGV0L3pjcy84LjAuNC9qc2RvY3Mvc3ltYm9scy9abU1pbWVQYXJ0Lmh0bWxcclxuICovXHJcblxyXG4vKipcclxuICogQGV4dGVybmFsIHppbWJyYU1haWwubWFpbC52aWV3XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBjbGFzcyBleHRlcm5hbDp6aW1icmFNYWlsLm1haWwudmlldy5abUNvbnZWaWV3MlxyXG4gKiBAc2VlIGh0dHA6Ly9maWxlcy56aW1icmEuY29tL2RvY3MvemltbGV0L3pjcy84LjAuNC9qc2RvY3Mvc3ltYm9scy9abUNvbnZWaWV3Mi5odG1sXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBjbGFzcyBleHRlcm5hbDp6aW1icmFNYWlsLm1haWwudmlldy5abU1haWxNc2dWaWV3XHJcbiAqIEBzZWUgaHR0cDovL2ZpbGVzLnppbWJyYS5jb20vZG9jcy96aW1sZXQvemNzLzguMC40L2pzZG9jcy9zeW1ib2xzL1ptTWFpbE1zZ1ZpZXcuaHRtbFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBAZXh0ZXJuYWwgemltYnJhTWFpbC5zaGFyZS5tb2RlbFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBAY2xhc3MgZXh0ZXJuYWw6emltYnJhTWFpbC5zaGFyZS5tb2RlbC5abVppbWxldEJhc2VcclxuICogQHNlZSBodHRwOi8vZmlsZXMuemltYnJhLmNvbS9kb2NzL3ppbWxldC96Y3MvOC4wLjQvanNkb2NzL3N5bWJvbHMvWm1aaW1sZXRCYXNlLmh0bWxcclxuICovXHJcblxyXG4vKipcclxuICogQHR5cGVkZWYge09iamVjdH0gb3JnX29wZW5fc3dfcGdwLm1lc3NhZ2VDb250ZXh0XHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaXZJZCAtIFBHUC1aaW1sZXQgaW5mbyBiYXIgZGl2IGlkXHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtYWlsTXNnSWQgLSBaaW1icmEgbWFpbCBtZXNzYWdlIGlkXHJcbiAqIEBwcm9wZXJ0eSB7ZXh0ZXJuYWw6b3BlbnBncC5jbGVhcnRleHR9IGNsZWFydGV4dCAtIE9iamVjdCByZXByZXNlbnRpbmcgdGhlIGNsZWFydGV4dCBzaWduZWQgbWVzc2FnZVxyXG4gKiBAcHJvcGVydHkge2V4dGVybmFsOm9wZW5wZ3Aua2V5W119IGtleUxpc3QgLSBMaXN0IG9mIHB1YmxpYyBrZXlzIHVzZWQgdG8gc2lnbiBtZXNzYWdlXHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nW119IGtleUlkTGlzdCAtIExpc3Qgb2YgcHVibGljIGtleSBpZHMgdXNlZCB0byBzaWduIG1lc3NhZ2VcclxuICovXHJcblxyXG4vKipcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW3Rlc3RNb2RlPWZhbHNlXSAtIFNldCB0byB0cnVlIHdoZW4gb3BlcmF0aW5nIHVuZGVyIHRoZSB0ZXN0IGhhcm5lc3NcclxuICogQHBhcmFtIHtleHRlcm5hbDprZXlyaW5nfSBba2V5cmluZ10gLSBLZXlyaW5nIG9iamVjdFxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwID0gZnVuY3Rpb24gKHRlc3RNb2RlLCBrZXlyaW5nKSB7XHJcblx0dGhpcy50ZXN0TW9kZSA9IHRlc3RNb2RlID8gdHJ1ZSA6IGZhbHNlO1xyXG5cdHRoaXMua2V5cmluZyA9IGtleXJpbmcgPyBrZXlyaW5nIDogcmVxdWlyZSgna2V5cmluZycpO1xyXG5cdG9wZW5wZ3AudXRpbC5wcmludF9vdXRwdXQgPSBmdW5jdGlvbiAobGV2ZWwsIHN0cikge1xyXG5cdFx0aWYgKCF0aGlzLnRlc3RNb2RlKSB7XHJcblx0XHRcdHZhciBoZWFkZXIgPSBcIlVOS05PV05cIjtcclxuXHRcdFx0c3dpdGNoIChsZXZlbCkge1xyXG5cdFx0XHRcdGNhc2Ugb3BlbnBncC51dGlsLnByaW50TGV2ZWwuZXJyb3I6XHJcblx0XHRcdFx0XHRoZWFkZXIgPSBcIkVSUk9SXCI7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlIG9wZW5wZ3AudXRpbC5wcmludExldmVsLndhcm5pbmc6XHJcblx0XHRcdFx0XHRoZWFkZXIgPSBcIldBUk5JTkdcIjtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2Ugb3BlbnBncC51dGlsLnByaW50TGV2ZWwuaW5mbzpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiSU5GT1wiO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBvcGVucGdwLnV0aWwucHJpbnRMZXZlbC5kZWJ1ZzpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiREVCVUdcIjtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coaGVhZGVyICsgJzogJyArIHN0cik7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH07XHJcbn07XHJcblxyXG4vKiogXHJcbiAqIEJ1aWxkIHByb3RvdHlwZSB3aXRoIGJhc2UgY29uc3RydWN0b3IgYW5kIG9iamVjdEhhbmRsZXIncyBjb25zdHJ1Y3RvclxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZSA9IG5ldyBabVppbWxldEJhc2UoKTtcclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IG9yZ19vcGVuX3N3X3BncDtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gb3VyIGNsYXNzIG5hbWVcclxuICogQHJldHVybiB7c3RyaW5nfVxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcclxuXHRyZXR1cm4gXCJvcmdfb3Blbl9zd19wZ3BcIjtcclxufTtcclxuXHJcbi8qKiBcclxuICogSW5pdGlhbGl6ZSB6aW1sZXRcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICgpIHtcclxuXHR0aGlzLmhhc0xvY2FsU3RvcmFnZSA9IHR5cGVvZih3aW5kb3cubG9jYWxTdG9yYWdlKSA9PSBcIm9iamVjdFwiO1xyXG5cclxuICAgIHRoaXMuX2tleXJpbmdUYWJBcHBOYW1lID0gdGhpcy5jcmVhdGVBcHAoXCJQR1AgS2V5cmluZ1wiLCBcImtleXJpbmdUYWJJY29uXCIsIFwiVmlldyBhbmQgQ2hhbmdlIFBHUCBLZXlyaW5nXCIpO1xyXG5cclxuXHQvL29wZW5wZ3AuY29uZmlnLmRlYnVnID0gdHJ1ZTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDYWxsZWQgYnkgWmltYnJhIHdoZW4gYSBuZXcgY29udmVyc2F0aW9uIGlzIHNob3duXHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLm1vZGVsLlptTWFpbE1zZ30gbXNnIC0gTmV3IG1lc3NhZ2VcclxuICogQHBhcmFtIHtleHRlcm5hbDp6aW1icmFNYWlsLm1haWwubW9kZWwuWm1NYWlsTXNnfSBvbGRNc2cgLSBQcmV2aW91cyBtZXNzYWdlXHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLnZpZXcuWm1Db252VmlldzJ9IHZpZXcgLSBDb252ZXJzYXRpb24gdmlld1xyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLm9uQ29udlZpZXcgPSBmdW5jdGlvbiAobXNnLCBvbGRNc2csIHZpZXcpIHtcclxuXHR0aGlzLl9wcm9jZXNzTXNnKG1zZywgdmlldyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ2FsbGVkIGJ5IFppbWJyYSB3aGVuIGEgbmV3IG1haWwgbWVzc2FnZSBpcyBzaG93blxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOnppbWJyYU1haWwubWFpbC5tb2RlbC5abU1haWxNc2d9IG1zZyAtIE5ldyBtZXNzYWdlXHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLm1vZGVsLlptTWFpbE1zZ30gb2xkTXNnIC0gUHJldmlvdXMgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOnppbWJyYU1haWwubWFpbC52aWV3LlptTWFpbE1zZ1ZpZXd9IHZpZXcgLSBNYWlsIG1lc3NhZ2Ugdmlld1xyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5vbk1zZ1ZpZXcgPSBmdW5jdGlvbiAobXNnLCBvbGRNc2csIHZpZXcpIHtcclxuXHR0aGlzLl9wcm9jZXNzTXNnKG1zZywgdmlldyk7XHJcbn07XHJcblxyXG4vKipcclxuICogUHJvY2VzcyBhIG5ldyBtYWlsIG1lc3NhZ2VcclxuICogQHBhcmFtIHtleHRlcm5hbDp6aW1icmFNYWlsLm1haWwubW9kZWwuWm1NYWlsTXNnfSBtc2cgLSBOZXcgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOnppbWJyYU1haWwubWFpbC52aWV3LlptQ29udlZpZXcyfGV4dGVybmFsOnppbWJyYU1haWwubWFpbC52aWV3LlptTWFpbE1zZ1ZpZXd9IHZpZXcgLSBDb252ZXJzYXRpb24gb3IgbWFpbCBtZXNzYWdlIHZpZXdcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX3Byb2Nlc3NNc2cgPSBmdW5jdGlvbiAobXNnLCB2aWV3KSB7XHJcblx0dmFyIGVsZW1JZCA9IHZpZXcuX2h0bWxFbElkICsgJ19fUEdQLVppbWxldCc7XHJcblxyXG5cdHZhciBkaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbGVtSWQpO1xyXG5cclxuXHRpZiAoZGl2KSB7XHJcblx0XHR2YXIgaHRtbCA9IHRoaXMuX2dldEZyb21UZW1wQ2FjaGUobXNnLmlkKTtcclxuXHJcblx0XHRpZiAoaHRtbCkge1xyXG5cdFx0XHQvLyBNYWtlIHRoZSBiYXIgdmlzaWJsZVxyXG5cdFx0XHRkaXYuaW5uZXJIVE1MID0gaHRtbDtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gR2V0IHRoZSBwbGFpbiB0ZXh0IGJvZHlcclxuXHRtc2cuZ2V0Qm9keVBhcnQoWm1NaW1lVGFibGUuVEVYVF9QTEFJTiwgQWp4Q2FsbGJhY2suc2ltcGxlQ2xvc3VyZSh0aGlzLl9wcm9jZXNzTXNnQ0IsIHRoaXMsIHZpZXcsIGRpdiwgbXNnLmlkKSk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ2FsbGJhY2sgaW52b2tlZCB3aXRoIHRleHQvcGxhaW4gdmVyc2lvbiBvZiBtZXNzYWdlXHJcbiAqIEBjYWxsYmFjayBvcmdfb3Blbl9zd19wZ3AuX3Byb2Nlc3NNc2dDQlxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOnppbWJyYU1haWwubWFpbC52aWV3LlptQ29udlZpZXcyfGV4dGVybmFsOnppbWJyYU1haWwubWFpbC52aWV3LlptTWFpbE1zZ1ZpZXd9IHZpZXcgLSBDb252ZXJzYXRpb24gb3IgbWFpbCBtZXNzYWdlIHZpZXdcclxuICogQHBhcmFtIHtleHRlcm5hbDpIVE1MRWxlbWVudH0gZGl2IC0gUEdQLVppbWxldCBpbmZvIGJhclxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbXNnSWQgLSBaaW1icmEgbWVzc2FnZSBpZFxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOnppbWJyYU1haWwubWFpbC5tb2RlbC5abU1pbWVQYXJ0fSBib2R5UGFydCAtIE1JTUUgcGFydCB3aXRoIHRleHQvcGxhaW4gYm9keVxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fcHJvY2Vzc01zZ0NCID0gZnVuY3Rpb24gKHZpZXcsIGRpdiwgbXNnSWQsIGJvZHlQYXJ0KSB7XHJcblx0aWYgKGJvZHlQYXJ0KSB7XHJcblx0XHR2YXIgbXNnVGV4dCA9IGJvZHlQYXJ0LmdldENvbnRlbnQoKTtcclxuXHJcblx0XHRpZiAobXNnVGV4dC5tYXRjaCgvXi0tLS0tQkVHSU4gKC4qKS0tLS0tJC9tKSkge1xyXG5cdFx0XHRpZiAoIWRpdikge1xyXG5cdFx0XHRcdHZhciBib2R5RGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodmlldy5fbXNnQm9keURpdklkKTtcclxuXHJcblx0XHRcdFx0ZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdFx0XHRkaXYuaWQgPSB2aWV3Ll9odG1sRWxJZCArICdfX1BHUC1aaW1sZXQnO1xyXG5cdFx0XHRcdGRpdi5jbGFzc05hbWUgPSAncGdwSW5mb0Jhcic7XHJcblxyXG5cdFx0XHRcdGJvZHlEaXYucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoZGl2LCBib2R5RGl2KTtcclxuXHJcblx0XHRcdFx0ZGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZGl2LmlkKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIG1zZ0NvbnRleHQgPSB7IGRpdklkOmRpdi5pZCwgbWFpbE1zZ0lkOiBtc2dJZCB9O1xyXG5cclxuXHRcdFx0Ly8gUGFyc2Ugb3V0IG91ciBzaWduYXR1cmUgc3R1ZmYgYW5kIG1lc3NhZ2UgdGV4dFxyXG5cdFx0XHRtc2dDb250ZXh0LmNsZWFydGV4dCA9IG9wZW5wZ3AuY2xlYXJ0ZXh0LnJlYWRBcm1vcmVkKG1zZ1RleHQpO1xyXG5cclxuXHRcdFx0aWYgKG1zZ0NvbnRleHQuY2xlYXJ0ZXh0KSB7XHJcblx0XHRcdFx0dGhpcy5fZGlzcGxheVZlcmlmeUJhcihtc2dDb250ZXh0KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9kaXNwbGF5UmVzdWx0QmFyKG1zZ0NvbnRleHQsIGZhbHNlLCAndW5rbm93bicsICd1bmtub3duJywgJ0Vycm9yIHBhcnNpbmcgbWVzc2FnZScpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodGhpcy50ZXN0TW9kZSkge1xyXG5cdFx0XHRcdHRoaXMuX3NlYXJjaEZvcktleShtc2dDb250ZXh0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBTZWFyY2hlcyBjYWNoZSBmb3Iga2V5LCBpZiBub3QgZm91bmQsIGFzayBhYm91dCBnb2luZyBvbmxpbmVcclxuICogQHBhcmFtIHtvcmdfb3Blbl9zd19wZ3AubWVzc2FnZUNvbnRleHR9IG1zZ0NvbnRleHQgLSBDb250ZXh0IGZvciBwcm9jZXNzaW5nIFppbWJyYSBtYWlsIG1lc3NhZ2VcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX3NlYXJjaEZvcktleSA9IGZ1bmN0aW9uIChtc2dDb250ZXh0KSB7XHJcblx0bXNnQ29udGV4dC5rZXlMaXN0ID0gW107XHJcblx0bXNnQ29udGV4dC5rZXlJZExpc3QgPSBbXTtcclxuXHR2YXIga2V5SWRMaXN0ID0gbXNnQ29udGV4dC5jbGVhcnRleHQuZ2V0U2lnbmluZ0tleUlkcygpO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwga2V5SWRMaXN0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHR2YXIga2V5SWQgPSBvcGVucGdwLnV0aWwuaGV4c3RyZHVtcChrZXlJZExpc3RbaV0ud3JpdGUoKSk7XHJcblx0XHR2YXIgcHVibGljS2V5TGlzdCA9IHRoaXMua2V5cmluZy5nZXRLZXlzRm9yS2V5SWQoa2V5SWQpO1xyXG5cdFx0aWYgKHB1YmxpY0tleUxpc3QgJiYgcHVibGljS2V5TGlzdC5sZW5ndGggPiAwKSB7XHJcblx0XHRcdG1zZ0NvbnRleHQua2V5TGlzdCA9IG1zZ0NvbnRleHQua2V5TGlzdC5jb25jYXQocHVibGljS2V5TGlzdCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtc2dDb250ZXh0LmtleUlkTGlzdC5wdXNoKGtleUlkKTtcclxuXHRcdH1cclxuXHR9XHJcblx0aWYgKG1zZ0NvbnRleHQua2V5TGlzdC5sZW5ndGggPiAwKSB7XHJcblx0XHQvLyBJZiB0aGlzIGtleSBpcyBmb3VuZCBpbiB0aGUgY2FjaGVcclxuXHRcdHRoaXMuX21zZ1ZlcmlmeShtc2dDb250ZXh0KTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0aWYgKCF0aGlzLnRlc3RNb2RlKSB7XHJcblx0XHRcdC8vIE90aGVyd2lzZSwgYXNrIGFib3V0IGdvaW5nIG9ubGluZVxyXG5cdFx0XHR2YXIgZGlhbG9nID0gYXBwQ3R4dC5nZXRZZXNOb01zZ0RpYWxvZygpOyBcclxuXHRcdFx0dmFyIGVyck1zZyA9IFwiQ291bGQgbm90IGZpbmQgcHVibGljIGtleSBpbiB0aGUgY2FjaGUsIHNlYXJjaCBwZ3AubWl0LmVkdSBmb3IgaXQ/XCI7XHJcblx0XHRcdHZhciBzdHlsZSA9IER3dE1lc3NhZ2VEaWFsb2cuSU5GT19TVFlMRTtcclxuXHJcblx0XHRcdGRpYWxvZy5zZXRCdXR0b25MaXN0ZW5lcihEd3REaWFsb2cuWUVTX0JVVFRPTiwgbmV3IEFqeExpc3RlbmVyKHRoaXMsIHRoaXMuX3NlYXJjaEJ0bkxpc3RlbmVyLCBtc2dDb250ZXh0KSk7XHJcblx0XHRcdGRpYWxvZy5zZXRCdXR0b25MaXN0ZW5lcihEd3REaWFsb2cuTk9fQlVUVE9OLCBuZXcgQWp4TGlzdGVuZXIodGhpcywgdGhpcy5fZGlhbG9nQ2xvc2VMaXN0ZW5lcikpO1xyXG5cclxuXHRcdFx0ZGlhbG9nLnJlc2V0KCk7XHJcblx0XHRcdGRpYWxvZy5zZXRNZXNzYWdlKGVyck1zZywgc3R5bGUpO1xyXG5cdFx0XHRkaWFsb2cucG9wdXAoKTtcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogRXZlbnQgaGFuZGxlciBmb3Igc2VhcmNoIGludGVybmV0IGZvciBrZXlcclxuICogQGNhbGxiYWNrIG9yZ19vcGVuX3N3X3BncC5fc2VhcmNoQnRuTGlzdGVuZXJcclxuICogQHBhcmFtIHtvcmdfb3Blbl9zd19wZ3AubWVzc2FnZUNvbnRleHR9IG1zZ0NvbnRleHQgLSBDb250ZXh0IGZvciBwcm9jZXNzaW5nIFppbWJyYSBtYWlsIG1lc3NhZ2VcclxuICogQHBhcmFtIHtleHRlcm5hbDphamF4LmR3dC5ldmVudHMuRHd0U2VsZWN0aW9uRXZlbnR9IGV2ZW50b2JqIC0gQWpheCBzZWxlY3Rpb24gZXZlbnQgb2JqZWN0XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9zZWFyY2hCdG5MaXN0ZW5lciA9IGZ1bmN0aW9uIChtc2dDb250ZXh0LCBldmVudG9iaikge1xyXG5cdGlmIChldmVudG9iaikge1xyXG5cdFx0ZXZlbnRvYmouaXRlbS5wYXJlbnQucG9wZG93bigpO1xyXG5cdH1cclxuXHJcblx0dmFyIGtleWlkID0gbXNnQ29udGV4dC5rZXlJZExpc3RbMF07XHJcblx0dmFyIHJlc3BvbnNlID0gQWp4UnBjLmludm9rZShudWxsLCAnL3NlcnZpY2UvemltbGV0L29yZ19vcGVuX3N3X3BncC9sb29rdXAuanNwP2tleT0weCcra2V5aWQsIG51bGwsIG51bGwsIHRydWUpO1xyXG5cdC8vIElmIHdlIGRvbid0IGhhdmUgYSBudWxsIHJlc3BvbnNlXHJcblx0aWYgKHJlc3BvbnNlLnRleHQgIT09IFwiXCIgJiYgcmVzcG9uc2UudHh0ICE9PSBcIk5vIGVtYWlsIHNwZWNpZmllZFwiKSB7XHJcblx0XHQvLyBJZiB0aGUga2V5IHdhcyBmb3VuZCwgXHJcblx0XHQvLyBDcmVhdGUgYSBuZXcgdGVtcG9yYXJ5IGRpdiB0byBwb3B1bGF0ZSB3aXRoIG91ciByZXNwb25zZSBzbyB3ZSBjYW4gbmF2aWdhdGUgaXQgZWFzaWVyLCBhbmQgaGlkZSBpdC5cclxuXHRcdHZhciB0ZW1wX2RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0dGVtcF9kaXYuaW5uZXJIVE1MID0gcmVzcG9uc2UudGV4dDtcclxuXHRcdHZhciBrZXl0ZXh0ID0gdGVtcF9kaXYuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3ByZScpWzBdLmlubmVySFRNTDtcclxuXHRcdHRoaXMua2V5cmluZy5pbXBvcnRLZXkoa2V5dGV4dCk7XHJcblx0XHR0aGlzLl9tc2dWZXJpZnkobXNnQ29udGV4dCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIElmIG5vIGtleSB3YXMgZm91bmQsIGVycm9yIG91dCBhbmQgZGlzcGxheSB0aGUgcHJvYmxlbS4gXHJcblx0XHQvLyBXaWxsIHVwZGF0ZSBzbyBtYW51YWwga2V5IGVudHJ5IGlzIHBvc3NpYmxlIGxhdGVyLiBcclxuXHRcdHZhciBkaWFsb2cgPSBhcHBDdHh0LmdldFllc05vTXNnRGlhbG9nKCk7IFxyXG5cdFx0dmFyIGVyck1zZyA9IFwiQ291bGQgbm90IGZpbmQgdGhlIGtleSBvbiBwZ3AubWl0LmVkdSwgZW50ZXIgaXQgbWFudWFsbHk/XCI7XHJcblx0XHR2YXIgc3R5bGUgPSBEd3RNZXNzYWdlRGlhbG9nLklORk9fU1RZTEU7XHJcblxyXG5cdFx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5ZRVNfQlVUVE9OLCBuZXcgQWp4TGlzdGVuZXIodGhpcywgX21hbnVhbEtleUVudHJ5LCBtc2dDb250ZXh0KSk7XHJcblx0XHRkaWFsb2cuc2V0QnV0dG9uTGlzdGVuZXIoRHd0RGlhbG9nLk5PX0JVVFRPTiwgbmV3IEFqeExpc3RlbmVyKHRoaXMsIF9kaWFsb2dDbG9zZUxpc3RlbmVyKSk7XHJcblxyXG5cdFx0ZGlhbG9nLnJlc2V0KCk7XHJcblx0XHRkaWFsb2cuc2V0TWVzc2FnZShlcnJNc2csIHN0eWxlKTtcclxuXHRcdGRpYWxvZy5wb3B1cCgpO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBEaXNwbGF5IGRpYWxvZyBmb3IgbWFudWFsIGtleSBpbXBvcnRcclxuICogQGNhbGxiYWNrIG9yZ19vcGVuX3N3X3BncC5fbWFudWFsS2V5RW50cnlcclxuICogQHBhcmFtIHtvcmdfb3Blbl9zd19wZ3AubWVzc2FnZUNvbnRleHR9IG1zZ0NvbnRleHQgLSBDb250ZXh0IGZvciBwcm9jZXNzaW5nIFppbWJyYSBtYWlsIG1lc3NhZ2VcclxuICogQHBhcmFtIHtleHRlcm5hbDphamF4LmR3dC5ldmVudHMuRHd0U2VsZWN0aW9uRXZlbnR9IGV2ZW50b2JqIC0gQWpheCBzZWxlY3Rpb24gZXZlbnQgb2JqZWN0XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9tYW51YWxLZXlFbnRyeSA9IGZ1bmN0aW9uIChtc2dDb250ZXh0LCBldmVudG9iaikge1xyXG5cdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHJcblx0dmFyIEhUTUwgPVx0JzxkaXYgaWQ9XCJrZXlFbnRyeURpdlwiPicgK1xyXG5cdFx0XHRcdFx0Jzx0ZXh0YXJlYSBpZD1cImtleUVudHJ5VGV4dGFyZWFcIj48L3RleHRhcmVhPicgK1xyXG5cdFx0XHRcdCc8L2Rpdj4nO1xyXG5cclxuXHR2YXIgc0RpYWxvZ1RpdGxlID0gXCI8Y2VudGVyPkVudGVyIGluIHRoZSBwdWJsaWMga2V5IGFuZCBwcmVzcyBcXFwiT0tcXFwiPC9jZW50ZXI+XCI7XHJcblxyXG5cdHZhciB2aWV3ID0gbmV3IER3dENvbXBvc2l0ZShhcHBDdHh0LmdldFNoZWxsKCkpO1xyXG5cdHZpZXcuc2V0U2l6ZShcIjUwMFwiLCBcIjUwMFwiKTsgXHJcblx0dmlldy5nZXRIdG1sRWxlbWVudCgpLnN0eWxlLm92ZXJmbG93ID0gXCJhdXRvXCI7XHJcblx0dmlldy5nZXRIdG1sRWxlbWVudCgpLmlubmVySFRNTCA9IEhUTUw7XHJcblxyXG5cdC8vIHBhc3MgdGhlIHRpdGxlLCB2aWV3ICYgYnV0dG9ucyBpbmZvcm1hdGlvbiB0byBjcmVhdGUgZGlhbG9nIGJveFxyXG5cdHZhciBkaWFsb2cgPSBuZXcgWm1EaWFsb2coe3RpdGxlOnNEaWFsb2dUaXRsZSwgdmlldzp2aWV3LCBwYXJlbnQ6YXBwQ3R4dC5nZXRTaGVsbCgpLCBzdGFuZGFyZEJ1dHRvbnM6W0R3dERpYWxvZy5PS19CVVRUT05dfSk7XHJcblx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5PS19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCB0aGlzLl9yZWFkS2V5TGlzdGVuZXIsIG1zZ0NvbnRleHQpKTtcclxuXHRkaWFsb2cucG9wdXAoKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBFdmVudCBoYW5kbGVyIGZvciBpbXBvcnQga2V5XHJcbiAqIEBjYWxsYmFjayBvcmdfb3Blbl9zd19wZ3AuX3JlYWRLZXlMaXN0ZW5lclxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOmFqYXguZHd0LmV2ZW50cy5Ed3RTZWxlY3Rpb25FdmVudH0gZXZlbnRvYmogLSBBamF4IHNlbGVjdGlvbiBldmVudCBvYmplY3RcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX3JlYWRLZXlMaXN0ZW5lciA9IGZ1bmN0aW9uIChtc2dDb250ZXh0LCBldmVudG9iaikge1xyXG5cdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHJcblx0Ly8gR2V0IG91ciBrZXkgcGFzdGVkIGluLCBhbmQgY2xlYXIgb3VyIHRoZSBlbnRyeSBpbiB0aGUgRE9NXHJcblx0dmFyIHBncEtleSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdrZXlFbnRyeVRleHRhcmVhJykudmFsdWU7XHJcblx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2tleUVudHJ5VGV4dGFyZWEnKS52YWx1ZSA9IFwiXCI7XHJcblx0dGhpcy5rZXlyaW5nLmltcG9ydEtleShwZ3BLZXkpO1xyXG5cdHRoaXMuX21zZ1ZlcmlmeShtc2dDb250ZXh0KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBWZXJpZnkgbWFpbCBtZXNzYWdlIHNpZ25hdHVyZVxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fbXNnVmVyaWZ5ID0gZnVuY3Rpb24gKG1zZ0NvbnRleHQpIHtcclxuXHR2YXIgaW5kZXg7XHJcblxyXG5cdGlmIChtc2dDb250ZXh0LmtleUxpc3QubGVuZ3RoID09PSAwKSB7XHJcblx0XHR2YXIga2V5SWRMaXN0ID0gbXNnQ29udGV4dC5jbGVhcnRleHQuZ2V0U2lnbmluZ0tleUlkcygpO1xyXG5cdFx0Zm9yIChpbmRleCA9IDA7IGluZGV4IDwga2V5SWRMaXN0Lmxlbmd0aDsgaW5kZXgrKykge1xyXG5cdFx0XHR2YXIgcHVibGljS2V5TGlzdCA9IHRoaXMua2V5cmluZy5nZXRLZXlzRm9yS2V5SWQob3BlbnBncC51dGlsLmhleHN0cmR1bXAoa2V5SWRMaXN0W2luZGV4XS53cml0ZSgpKSk7XHJcblx0XHRcdGlmIChwdWJsaWNLZXlMaXN0ICE9PSBudWxsICYmIHB1YmxpY0tleUxpc3QubGVuZ3RoID4gMCkge1xyXG5cdFx0XHRcdG1zZ0NvbnRleHQua2V5TGlzdCA9IG1zZ0NvbnRleHQua2V5TGlzdC5jb25jYXQocHVibGljS2V5TGlzdCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciByZXN1bHQgPSBmYWxzZTtcclxuXHR2YXIgaWQgPSBcIjB4XCIgKyBvcGVucGdwLnV0aWwuaGV4c3RyZHVtcChtc2dDb250ZXh0LmtleUxpc3RbMF0uZ2V0S2V5SWRzKClbMF0ud3JpdGUoKSkuc3Vic3RyaW5nKDgpO1xyXG5cdHZhciB1c2VyID0gbXNnQ29udGV4dC5rZXlMaXN0WzBdLmdldFVzZXJJZHMoKVswXTtcclxuXHJcblx0dmFyIHZlcmlmeVJlc3VsdCA9IG1zZ0NvbnRleHQuY2xlYXJ0ZXh0LnZlcmlmeShtc2dDb250ZXh0LmtleUxpc3QpO1xyXG5cdGlmICh2ZXJpZnlSZXN1bHQpIHtcclxuXHRcdGZvciAoaW5kZXggPSAwOyBpbmRleCA8IHZlcmlmeVJlc3VsdC5sZW5ndGg7IGluZGV4KyspIHtcclxuXHRcdFx0aWYgKHZlcmlmeVJlc3VsdFtpbmRleF0udmFsaWQpIHtcclxuXHRcdFx0XHRyZXN1bHQgPSB0cnVlO1xyXG5cdFx0XHRcdGlkID0gXCIweFwiICsgb3BlbnBncC51dGlsLmhleHN0cmR1bXAodmVyaWZ5UmVzdWx0W2luZGV4XS5rZXlpZC53cml0ZSgpKS5zdWJzdHJpbmcoOCk7XHJcblx0XHRcdFx0dXNlciA9IG1zZ0NvbnRleHQua2V5TGlzdFtpbmRleF0uZ2V0VXNlcklkcygpWzBdO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR0aGlzLl9kaXNwbGF5UmVzdWx0QmFyKG1zZ0NvbnRleHQsIHJlc3VsdCwgaWQsIHVzZXIpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSBjYWNoZWQgcmVzdWx0IGh0bWwgZm9yIHByZXZpb3VzbHkgdmVyaWZpZWQgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbXNnSWQgLSBaaW1icmEgbWFpbCBtZXNzYWdlIGlkXHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9yZW1vdmVGcm9tVGVtcENhY2hlID0gZnVuY3Rpb24gKG1zZ0lkKSB7XHJcblx0Ly8gSWYgd2UgaGF2ZSB0aGUgbmVjZXNzYXJ5IHNlc3Npb25TdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0c2Vzc2lvblN0b3JhZ2UucmVtb3ZlSXRlbShtc2dJZCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIEJ5IGRlZmF1bHQgY29va2llcyBhcmUgYWxsIHNlc3Npb25cclxuXHRcdGRvY3VtZW50LmNvb2tpZS5yZW1vdmVJdGVtKCdQR1BWZXJpZmllZF8nICsgbXNnSWQpO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdG9yZSBjYWNoZWQgcmVzdWx0IGh0bWwgZm9yIHByZXZpb3VzbHkgdmVyaWZpZWQgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbXNnSWQgLSBaaW1icmEgbWFpbCBtZXNzYWdlIGlkXHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9zdG9yZUluVGVtcENhY2hlID0gZnVuY3Rpb24gKG1zZ0lkLCBIVE1MKSB7XHJcblx0Ly8gSWYgd2UgaGF2ZSB0aGUgbmVjZXNzYXJ5IHNlc3Npb25TdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0c2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbShtc2dJZCwgZXNjYXBlKEhUTUwpKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly8gQnkgZGVmYXVsdCBjb29raWVzIGFyZSBhbGwgc2Vzc2lvblxyXG5cdFx0ZG9jdW1lbnQuY29va2llID0gJ1BHUFZlcmlmaWVkXycgKyBtc2dJZCArJz0nKyBlc2NhcGUoSFRNTCk7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBjYWNoZWQgcmVzdWx0IGh0bWwgZm9yIHByZXZpb3VzbHkgdmVyaWZpZWQgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbXNnSWQgLSBaaW1icmEgbWFpbCBtZXNzYWdlIGlkXHJcbiAqIEByZXR1cm4ge3N0cmluZ30gcmVzdWx0IGh0bWxcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2dldEZyb21UZW1wQ2FjaGUgPSBmdW5jdGlvbiAobXNnSWQpIHtcclxuXHQvLyBJZiB3ZSBoYXZlIHRoZSBuZWNlc3NhcnkgbG9jYWxTdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0bXNnSFRNTCA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0obXNnSWQpO1xyXG5cdFx0aWYgKG1zZ0hUTUwgIT09IG51bGwpIHtcclxuXHRcdFx0bXNnSFRNTCA9IHVuZXNjYXBlKG1zZ0hUTUwpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG1zZ0hUTUw7XHJcblx0fSBlbHNlIHtcclxuXHRcdHZhciBjb29raWVzID0gZG9jdW1lbnQuY29va2llLnNwbGl0KCc7Jyk7XHJcblx0XHR2YXIgcGdwQ29va2llcyA9IFtdO1xyXG5cdFx0Zm9yIChpPTA7aTxjb29raWVzLmxlbmd0aDtpKyspIHtcclxuXHRcdFx0Ly8gUG9wdWxhdGUgb3VyIHBncENvb2tpZXMgYXJyYXkgd2l0aCB0aGUgcG9pbnRlcnMgdG8gdGhlIGNvb2tpZXMgd2Ugd2FudFxyXG5cdFx0XHRpZiAoY29va2llc1tpXS5pbmRleE9mKCdQR1BWZXJpZmllZF8nKSAhPSAtMSkge1xyXG5cdFx0XHRcdHBncENvb2tpZXMucHVzaChpKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0Ly8gRm9yIGVhY2ggUEdQIGNvb2tpZVxyXG5cdFx0Zm9yIChpPTA7aTxwZ3BDb29raWVzLmxlbmd0aDtpKyspIHsgICAgIFxyXG5cdFx0XHRpZiAoY29va2llc1twZ3BDb29raWVzW2ldXS5yZXBsYWNlKC9eXFxzLywnJykuc3BsaXQoJz0nKVswXSA9PT0gXCJQR1BWZXJpZmllZF9cIiArIG1zZ0lkKSB7XHJcblx0XHRcdFx0Ly8gRGVsaWNpb3VzIGNvb2tpZXNcclxuXHRcdFx0XHRtc2dIVE1MID0gdW5lc2NhcGUoY29va2llc1twZ3BDb29raWVzW2ldXS5yZXBsYWNlKC9eXFxzLywnJykuc3BsaXQoJz0nKVsxXSk7XHJcblx0XHRcdFx0cmV0dXJuIG1zZ0hUTUw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH0gICAgXHJcbn07XHJcblxyXG4vKipcclxuICogRGlzcGxheSBiYXIgaW5kaWNhdGluZyBtZXNzYWdlIHNpZ25lZFxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fZGlzcGxheVZlcmlmeUJhciA9IGZ1bmN0aW9uIChtc2dDb250ZXh0KSB7XHJcblx0dmFyIHZhbHVlcyA9IHtcclxuXHRcdGxvZ286IHRoaXMuZ2V0UmVzb3VyY2UoJ3BncC5wbmcnKSxcclxuXHRcdGluZm9CYXJEaXZJZDogbXNnQ29udGV4dC5kaXZJZFxyXG5cdH07XHJcblx0dmFyIHppbWxldCA9IHRoaXM7XHJcblx0dmFyIGRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1zZ0NvbnRleHQuZGl2SWQpO1xyXG5cclxuXHRkaXYuaW5uZXJIVE1MID0gQWp4VGVtcGxhdGUuZXhwYW5kKFwib3JnX29wZW5fc3dfcGdwLnRlbXBsYXRlcy5wZ3AjaW5mb2Jhcl92ZXJpZnlcIiwgdmFsdWVzKTtcclxuXHJcblx0YnV0dG9ucyA9IGRpdi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwidmVyaWZ5QnV0dG9uXCIpO1xyXG5cdGJ1dHRvbnNbMF0ub25jbGljayA9IGZ1bmN0aW9uICgpIHsgemltbGV0Ll9zZWFyY2hGb3JLZXkobXNnQ29udGV4dCk7IH07XHJcblxyXG5cdGJ1dHRvbnMgPSBkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImVzY2FwZUJ1dHRvblwiKTtcclxuXHRidXR0b25zWzBdLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7IHppbWxldC5fZGVzdHJveUluZm9CYXIobXNnQ29udGV4dCk7IH07XHJcbn07XHJcblxyXG4vKipcclxuICogRGlzcGxheSBzaWduYXR1cmUgdmVyaWZpY2F0aW9uIHJlc3VsdFxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IHN1Y2NlZWRlZCAtIFRydWUgaWYgc2lnbmF0dXJlIHZlcmlmaWVkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXlJZCAtIElkIG9mIGtleSB1c2VkIHRvIHZlcmlmeSBtZXNzYWdlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB1c2VyIC0gVXNlciB3aGljaCBvd25zIGtleSB1c2VkIHRvIHZlcmlmeSBtZXNzYWdlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBbbXNnXSAtIEN1c3RvbSBmYWlsdXJlIG1lc3NhZ2VcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2Rpc3BsYXlSZXN1bHRCYXIgPSBmdW5jdGlvbiAobXNnQ29udGV4dCwgc3VjY2VlZGVkLCBrZXlJZCwgdXNlciwgbXNnKSB7XHJcblx0dXNlciA9IHVzZXIucmVwbGFjZSgnPCcsJyZsdDsnKS5yZXBsYWNlKCc+JywnJmd0OycpO1xyXG5cclxuXHRpZiAoIW1zZykge1xyXG5cdFx0bXNnID0gc3VjY2VlZGVkID8gJ3ZlcmlmaWVkIHN1Y2Nlc3NmdWxseSEnIDogJypOT1QqIHZlcmlmaWVkISc7XHJcblx0fVxyXG5cclxuXHR2YXIgdmFsdWVzID0ge1xyXG5cdFx0bG9nbzogdGhpcy5nZXRSZXNvdXJjZSgncGdwLnBuZycpLFxyXG5cdFx0Y2xhc3NOYW1lOiBzdWNjZWVkZWQgPyAnc3VjY2VzcycgOiAnZmFpbCcsXHJcblx0XHRpZDoga2V5SWQsXHJcblx0XHR1c2VyOiB1c2VyLFxyXG5cdFx0bXNnOiBtc2csXHJcblx0XHRpbmZvQmFyRGl2SWQ6IG1zZ0NvbnRleHQuZGl2SWRcclxuXHR9O1xyXG5cdHZhciB6aW1sZXQgPSB0aGlzO1xyXG5cdHZhciBkaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtc2dDb250ZXh0LmRpdklkKTtcclxuXHJcblx0ZGl2LmlubmVySFRNTCA9IEFqeFRlbXBsYXRlLmV4cGFuZChcIm9yZ19vcGVuX3N3X3BncC50ZW1wbGF0ZXMucGdwI2luZm9iYXJfcmVzdWx0XCIsIHZhbHVlcyk7XHJcblxyXG5cdGJ1dHRvbnMgPSBkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImVzY2FwZUJ1dHRvblwiKTtcclxuXHRidXR0b25zWzBdLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7IHppbWxldC5fZGVzdHJveUluZm9CYXIobXNnQ29udGV4dCk7IH07XHJcblxyXG5cdHRoaXMuX3N0b3JlSW5UZW1wQ2FjaGUobXNnQ29udGV4dCwgZGl2LmlubmVySFRNTCk7XHJcbn07XHJcblxyXG4vKipcclxuICogRXZlbnQgaGFuZGxlciBmb3IgaW5mbyBiYXIgY2xvc2UgYnV0dG9uXHJcbiAqIEBjYWxsYmFjayBvcmdfb3Blbl9zd19wZ3AuX2Rlc3Ryb3lJbmZvQmFyXHJcbiAqIEBwYXJhbSB7b3JnX29wZW5fc3dfcGdwLm1lc3NhZ2VDb250ZXh0fSBtc2dDb250ZXh0IC0gQ29udGV4dCBmb3IgcHJvY2Vzc2luZyBaaW1icmEgbWFpbCBtZXNzYWdlXHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2Rlc3Ryb3lJbmZvQmFyID0gZnVuY3Rpb24gKG1zZ0NvbnRleHQpIHtcclxuXHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtc2dDb250ZXh0LmRpdklkKS5pbm5lckhUTUwgPSBcIlwiO1xyXG5cdHRoaXMuX3JlbW92ZUZyb21UZW1wQ2FjaGUobXNnQ29udGV4dC5tYWlsTXNnSWQpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEV2ZW50IGhhbmRsZXIgZm9yIGNsb3NlIGJ1dHRvblxyXG4gKiBAY2FsbGJhY2sgb3JnX29wZW5fc3dfcGdwLl9kaWFsb2dDbG9zZUxpc3RlbmVyXHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6YWpheC5kd3QuZXZlbnRzLkR3dFNlbGVjdGlvbkV2ZW50fSBldmVudG9iaiAtIEFqYXggc2VsZWN0aW9uIGV2ZW50IG9iamVjdFxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fZGlhbG9nQ2xvc2VMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudG9iaikge1xyXG5cdGlmIChldmVudG9iaikge1xyXG5cdFx0ZXZlbnRvYmouaXRlbS5wYXJlbnQucG9wZG93bigpO1xyXG5cdH1cclxufTtcclxuLyoqXHJcbiAqIFRoaXMgbWV0aG9kIGdldHMgY2FsbGVkIGJ5IHRoZSBaaW1sZXQgZnJhbWV3b3JrIHdoZW4gdGhlIGFwcGxpY2F0aW9uIGlzIG9wZW5lZCBmb3IgdGhlIGZpcnN0IHRpbWUuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBhcHBOYW1lIC0gVGhlIGFwcGxpY2F0aW9uIG5hbWVcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuYXBwTGF1bmNoID0gZnVuY3Rpb24oYXBwTmFtZSkge1xyXG5cdHN3aXRjaCAoYXBwTmFtZSkge1xyXG5cdFx0Y2FzZSB0aGlzLl9rZXlyaW5nVGFiQXBwTmFtZToge1xyXG5cdFx0XHR2YXIgYXBwID0gYXBwQ3R4dC5nZXRBcHAoYXBwTmFtZSk7IC8vIGdldCBhY2Nlc3MgdG8gWm1aaW1sZXRBcHBcclxuXHJcblx0XHRcdHZhciBjb250ZW50ID0gdGhpcy5fY3JlYXRlVGFiVmlldygpO1xyXG5cdFx0XHRhcHAuc2V0Q29udGVudChjb250ZW50KTsgLy8gd3JpdGUgSFRNTCB0byBhcHBsaWNhdGlvbiB0YWJcclxuXHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIHRoZSB0YWIgdmlldyB1c2luZyB0aGUgdGVtcGxhdGUuXHJcbiAqXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gVGhlIHRhYiBIVE1MIGNvbnRlbnRcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2NyZWF0ZVRhYlZpZXcgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiAgQWp4VGVtcGxhdGUuZXhwYW5kKFwib3JnX29wZW5fc3dfcGdwLnRlbXBsYXRlcy5wZ3Aja2V5cmluZ190YWJcIik7XHJcbn07XHJcbiJdfQ==
(1)
});
;