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
	var html = this._getFromTempCache(msg.id);

	if (html) {
		var div = this._getInfoBarDiv(view);

		// Make the bar visible
		div.innerHTML = html;
		return;
	}

	// Get the plain text body
	msg.getBodyPart(ZmMimeTable.TEXT_PLAIN, AjxCallback.simpleClosure(this._processMsgCB, this, view, msg.id));
};

/**
 * Return info bar div, creating one if necessary
 * @param {external:zimbraMail.mail.view.ZmConvView2|external:zimbraMail.mail.view.ZmMailMsgView} view - Conversation or mail message view
 * @return {external:HTMLElement} PGP-Zimlet info bar div
 */
org_open_sw_pgp.prototype._getInfoBarDiv = function (view) {
	var elemId = view._htmlElId + '__PGP-Zimlet';
	var div = document.getElementById(elemId);

	if (!div) {
		var bodyDiv = document.getElementById(view._msgBodyDivId);

		div = document.createElement("div");
		div.id = elemId;
		div.className = 'pgpInfoBar';

		bodyDiv.parentElement.insertBefore(div, bodyDiv);

		div = document.getElementById(elemId);
	}
	return div;
};

/**
 * Callback invoked with text/plain version of message
 * @callback org_open_sw_pgp._processMsgCB
 * @param {external:zimbraMail.mail.view.ZmConvView2|external:zimbraMail.mail.view.ZmMailMsgView} view - Conversation or mail message view
 * @param {string} msgId - Zimbra message id
 * @param {external:zimbraMail.mail.model.ZmMimePart} bodyPart - MIME part with text/plain body
 */
org_open_sw_pgp.prototype._processMsgCB = function (view, msgId, bodyPart) {
	if (bodyPart) {
		var msgText = bodyPart.getContent();

		if (msgText.match(/^-----BEGIN (.*)-----$/m)) {
			var div = this._getInfoBarDiv(view);
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

	this._storeInTempCache(msgContext.mailMsgId, div.innerHTML);
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
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9yb2JlcnQvemltYnJhLXBncC9wZ3AtemltbGV0L3BncC16aW1sZXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiLy9cInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qXHJcblxyXG5UaGlzIGZpbGUgaXMgcmVzcG9uc2libGUgZm9yIGFsbCB0aGUgWmltYnJhIGludGVncmF0aW9uIGZ1bmN0aW9ucyBhbmQgZXZlcnl0aGluZ1xyXG5lbHNlIHRoYXQncyBkb25lIGluIHRoZSB6aW1icmEgaW50ZXJmYWNlXHJcblxyXG5UT0RPOlxyXG5cdD0+IEJ1dHRvbiB0aGF0IGxpbmtzIHRvIG15IEdpdGh1YlxyXG5cdD0+IEltcGxlbWVudCBvcHRpb25zIHZpYSBzZXRVc2VyUHJvcGVydHkoKSBhbmQgZ2V0VXNlclByb3BlcnR5KClcclxuXHJcbi8vIExpc3QgYWxsIHByb3BlcnRpZXMgaW4gb2JqZWN0XHJcbnByb3BlcnRpZXMgPSBhcHBDdHh0Ll96aW1sZXRNZ3IuX1pJTUxFVFNfQllfSURbJ29yZ19vcGVuX3N3X3BncCddLl9wcm9wc0J5SWRcclxuZm9yKHZhciBpIGluIHByb3BlcnRpZXMpIHtcclxuXHRpZiAocHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xyXG5cdFx0Y29uc29sZS5sb2coaSArIFwiID0gXCIgKyBwcm9wZXJ0aWVzW2ldLnZhbHVlKTtcclxuXHR9XHJcbn1cclxuXHJcblxyXG4qL1xyXG5cclxudmFyIG9wZW5wZ3AgPSByZXF1aXJlKCdvcGVucGdwJyk7XHJcblxyXG4vKipcclxuICogQGV4dGVybmFsIEhUTUxFbGVtZW50XHJcbiAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0hUTUxFbGVtZW50XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBleHRlcm5hbCBhamF4LmR3dC5ldmVudHNcclxuICovXHJcblxyXG4vKipcclxuICogQGNsYXNzIGV4dGVybmFsOmFqYXguZHd0LmV2ZW50cy5Ed3RTZWxlY3Rpb25FdmVudFxyXG4gKiBAc2VlIGh0dHA6Ly9maWxlcy56aW1icmEuY29tL2RvY3MvemltbGV0L3pjcy84LjAuNC9qc2RvY3Mvc3ltYm9scy9Ed3RTZWxlY3Rpb25FdmVudC5odG1sXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBleHRlcm5hbCB6aW1icmFNYWlsLm1haWwubW9kZWxcclxuICovXHJcblxyXG4vKipcclxuICogQGNsYXNzIGV4dGVybmFsOnppbWJyYU1haWwubWFpbC5tb2RlbC5abU1haWxNc2dcclxuICogQHNlZSBodHRwOi8vZmlsZXMuemltYnJhLmNvbS9kb2NzL3ppbWxldC96Y3MvOC4wLjQvanNkb2NzL3N5bWJvbHMvWm1NYWlsTXNnLmh0bWxcclxuICovXHJcblxyXG4vKipcclxuICogQGNsYXNzIGV4dGVybmFsOnppbWJyYU1haWwubWFpbC5tb2RlbC5abU1pbWVQYXJ0XHJcbiAqIEBzZWUgaHR0cDovL2ZpbGVzLnppbWJyYS5jb20vZG9jcy96aW1sZXQvemNzLzguMC40L2pzZG9jcy9zeW1ib2xzL1ptTWltZVBhcnQuaHRtbFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBAZXh0ZXJuYWwgemltYnJhTWFpbC5tYWlsLnZpZXdcclxuICovXHJcblxyXG4vKipcclxuICogQGNsYXNzIGV4dGVybmFsOnppbWJyYU1haWwubWFpbC52aWV3LlptQ29udlZpZXcyXHJcbiAqIEBzZWUgaHR0cDovL2ZpbGVzLnppbWJyYS5jb20vZG9jcy96aW1sZXQvemNzLzguMC40L2pzZG9jcy9zeW1ib2xzL1ptQ29udlZpZXcyLmh0bWxcclxuICovXHJcblxyXG4vKipcclxuICogQGNsYXNzIGV4dGVybmFsOnppbWJyYU1haWwubWFpbC52aWV3LlptTWFpbE1zZ1ZpZXdcclxuICogQHNlZSBodHRwOi8vZmlsZXMuemltYnJhLmNvbS9kb2NzL3ppbWxldC96Y3MvOC4wLjQvanNkb2NzL3N5bWJvbHMvWm1NYWlsTXNnVmlldy5odG1sXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBleHRlcm5hbCB6aW1icmFNYWlsLnNoYXJlLm1vZGVsXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEBjbGFzcyBleHRlcm5hbDp6aW1icmFNYWlsLnNoYXJlLm1vZGVsLlptWmltbGV0QmFzZVxyXG4gKiBAc2VlIGh0dHA6Ly9maWxlcy56aW1icmEuY29tL2RvY3MvemltbGV0L3pjcy84LjAuNC9qc2RvY3Mvc3ltYm9scy9abVppbWxldEJhc2UuaHRtbFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSBvcmdfb3Blbl9zd19wZ3AubWVzc2FnZUNvbnRleHRcclxuICogQHByb3BlcnR5IHtzdHJpbmd9IGRpdklkIC0gUEdQLVppbWxldCBpbmZvIGJhciBkaXYgaWRcclxuICogQHByb3BlcnR5IHtzdHJpbmd9IG1haWxNc2dJZCAtIFppbWJyYSBtYWlsIG1lc3NhZ2UgaWRcclxuICogQHByb3BlcnR5IHtleHRlcm5hbDpvcGVucGdwLmNsZWFydGV4dH0gY2xlYXJ0ZXh0IC0gT2JqZWN0IHJlcHJlc2VudGluZyB0aGUgY2xlYXJ0ZXh0IHNpZ25lZCBtZXNzYWdlXHJcbiAqIEBwcm9wZXJ0eSB7ZXh0ZXJuYWw6b3BlbnBncC5rZXlbXX0ga2V5TGlzdCAtIExpc3Qgb2YgcHVibGljIGtleXMgdXNlZCB0byBzaWduIG1lc3NhZ2VcclxuICogQHByb3BlcnR5IHtzdHJpbmdbXX0ga2V5SWRMaXN0IC0gTGlzdCBvZiBwdWJsaWMga2V5IGlkcyB1c2VkIHRvIHNpZ24gbWVzc2FnZVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHBhcmFtIHtib29sZWFufSBbdGVzdE1vZGU9ZmFsc2VdIC0gU2V0IHRvIHRydWUgd2hlbiBvcGVyYXRpbmcgdW5kZXIgdGhlIHRlc3QgaGFybmVzc1xyXG4gKiBAcGFyYW0ge2V4dGVybmFsOmtleXJpbmd9IFtrZXlyaW5nXSAtIEtleXJpbmcgb2JqZWN0XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AgPSBmdW5jdGlvbiAodGVzdE1vZGUsIGtleXJpbmcpIHtcclxuXHR0aGlzLnRlc3RNb2RlID0gdGVzdE1vZGUgPyB0cnVlIDogZmFsc2U7XHJcblx0dGhpcy5rZXlyaW5nID0ga2V5cmluZyA/IGtleXJpbmcgOiByZXF1aXJlKCdrZXlyaW5nJyk7XHJcblx0b3BlbnBncC51dGlsLnByaW50X291dHB1dCA9IGZ1bmN0aW9uIChsZXZlbCwgc3RyKSB7XHJcblx0XHRpZiAoIXRoaXMudGVzdE1vZGUpIHtcclxuXHRcdFx0dmFyIGhlYWRlciA9IFwiVU5LTk9XTlwiO1xyXG5cdFx0XHRzd2l0Y2ggKGxldmVsKSB7XHJcblx0XHRcdFx0Y2FzZSBvcGVucGdwLnV0aWwucHJpbnRMZXZlbC5lcnJvcjpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiRVJST1JcIjtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2Ugb3BlbnBncC51dGlsLnByaW50TGV2ZWwud2FybmluZzpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiV0FSTklOR1wiO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBvcGVucGdwLnV0aWwucHJpbnRMZXZlbC5pbmZvOlxyXG5cdFx0XHRcdFx0aGVhZGVyID0gXCJJTkZPXCI7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlIG9wZW5wZ3AudXRpbC5wcmludExldmVsLmRlYnVnOlxyXG5cdFx0XHRcdFx0aGVhZGVyID0gXCJERUJVR1wiO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhoZWFkZXIgKyAnOiAnICsgc3RyKTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxufTtcclxuXHJcbi8qKiBcclxuICogQnVpbGQgcHJvdG90eXBlIHdpdGggYmFzZSBjb25zdHJ1Y3RvciBhbmQgb2JqZWN0SGFuZGxlcidzIGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlID0gbmV3IFptWmltbGV0QmFzZSgpO1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gb3JnX29wZW5fc3dfcGdwO1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBvdXIgY2xhc3MgbmFtZVxyXG4gKiBAcmV0dXJuIHtzdHJpbmd9XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xyXG5cdHJldHVybiBcIm9yZ19vcGVuX3N3X3BncFwiO1xyXG59O1xyXG5cclxuLyoqIFxyXG4gKiBJbml0aWFsaXplIHppbWxldFxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24gKCkge1xyXG5cdHRoaXMuaGFzTG9jYWxTdG9yYWdlID0gdHlwZW9mKHdpbmRvdy5sb2NhbFN0b3JhZ2UpID09IFwib2JqZWN0XCI7XHJcblxyXG4gICAgdGhpcy5fa2V5cmluZ1RhYkFwcE5hbWUgPSB0aGlzLmNyZWF0ZUFwcChcIlBHUCBLZXlyaW5nXCIsIFwia2V5cmluZ1RhYkljb25cIiwgXCJWaWV3IGFuZCBDaGFuZ2UgUEdQIEtleXJpbmdcIik7XHJcblxyXG5cdC8vb3BlbnBncC5jb25maWcuZGVidWcgPSB0cnVlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENhbGxlZCBieSBaaW1icmEgd2hlbiBhIG5ldyBjb252ZXJzYXRpb24gaXMgc2hvd25cclxuICogQHBhcmFtIHtleHRlcm5hbDp6aW1icmFNYWlsLm1haWwubW9kZWwuWm1NYWlsTXNnfSBtc2cgLSBOZXcgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOnppbWJyYU1haWwubWFpbC5tb2RlbC5abU1haWxNc2d9IG9sZE1zZyAtIFByZXZpb3VzIG1lc3NhZ2VcclxuICogQHBhcmFtIHtleHRlcm5hbDp6aW1icmFNYWlsLm1haWwudmlldy5abUNvbnZWaWV3Mn0gdmlldyAtIENvbnZlcnNhdGlvbiB2aWV3XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUub25Db252VmlldyA9IGZ1bmN0aW9uIChtc2csIG9sZE1zZywgdmlldykge1xyXG5cdHRoaXMuX3Byb2Nlc3NNc2cobXNnLCB2aWV3KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDYWxsZWQgYnkgWmltYnJhIHdoZW4gYSBuZXcgbWFpbCBtZXNzYWdlIGlzIHNob3duXHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLm1vZGVsLlptTWFpbE1zZ30gbXNnIC0gTmV3IG1lc3NhZ2VcclxuICogQHBhcmFtIHtleHRlcm5hbDp6aW1icmFNYWlsLm1haWwubW9kZWwuWm1NYWlsTXNnfSBvbGRNc2cgLSBQcmV2aW91cyBtZXNzYWdlXHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLnZpZXcuWm1NYWlsTXNnVmlld30gdmlldyAtIE1haWwgbWVzc2FnZSB2aWV3XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLm9uTXNnVmlldyA9IGZ1bmN0aW9uIChtc2csIG9sZE1zZywgdmlldykge1xyXG5cdHRoaXMuX3Byb2Nlc3NNc2cobXNnLCB2aWV3KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBQcm9jZXNzIGEgbmV3IG1haWwgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOnppbWJyYU1haWwubWFpbC5tb2RlbC5abU1haWxNc2d9IG1zZyAtIE5ldyBtZXNzYWdlXHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLnZpZXcuWm1Db252VmlldzJ8ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLnZpZXcuWm1NYWlsTXNnVmlld30gdmlldyAtIENvbnZlcnNhdGlvbiBvciBtYWlsIG1lc3NhZ2Ugdmlld1xyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fcHJvY2Vzc01zZyA9IGZ1bmN0aW9uIChtc2csIHZpZXcpIHtcclxuXHR2YXIgaHRtbCA9IHRoaXMuX2dldEZyb21UZW1wQ2FjaGUobXNnLmlkKTtcclxuXHJcblx0aWYgKGh0bWwpIHtcclxuXHRcdHZhciBkaXYgPSB0aGlzLl9nZXRJbmZvQmFyRGl2KHZpZXcpO1xyXG5cclxuXHRcdC8vIE1ha2UgdGhlIGJhciB2aXNpYmxlXHJcblx0XHRkaXYuaW5uZXJIVE1MID0gaHRtbDtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8vIEdldCB0aGUgcGxhaW4gdGV4dCBib2R5XHJcblx0bXNnLmdldEJvZHlQYXJ0KFptTWltZVRhYmxlLlRFWFRfUExBSU4sIEFqeENhbGxiYWNrLnNpbXBsZUNsb3N1cmUodGhpcy5fcHJvY2Vzc01zZ0NCLCB0aGlzLCB2aWV3LCBtc2cuaWQpKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gaW5mbyBiYXIgZGl2LCBjcmVhdGluZyBvbmUgaWYgbmVjZXNzYXJ5XHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLnZpZXcuWm1Db252VmlldzJ8ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLnZpZXcuWm1NYWlsTXNnVmlld30gdmlldyAtIENvbnZlcnNhdGlvbiBvciBtYWlsIG1lc3NhZ2Ugdmlld1xyXG4gKiBAcmV0dXJuIHtleHRlcm5hbDpIVE1MRWxlbWVudH0gUEdQLVppbWxldCBpbmZvIGJhciBkaXZcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2dldEluZm9CYXJEaXYgPSBmdW5jdGlvbiAodmlldykge1xyXG5cdHZhciBlbGVtSWQgPSB2aWV3Ll9odG1sRWxJZCArICdfX1BHUC1aaW1sZXQnO1xyXG5cdHZhciBkaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbGVtSWQpO1xyXG5cclxuXHRpZiAoIWRpdikge1xyXG5cdFx0dmFyIGJvZHlEaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh2aWV3Ll9tc2dCb2R5RGl2SWQpO1xyXG5cclxuXHRcdGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblx0XHRkaXYuaWQgPSBlbGVtSWQ7XHJcblx0XHRkaXYuY2xhc3NOYW1lID0gJ3BncEluZm9CYXInO1xyXG5cclxuXHRcdGJvZHlEaXYucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoZGl2LCBib2R5RGl2KTtcclxuXHJcblx0XHRkaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbGVtSWQpO1xyXG5cdH1cclxuXHRyZXR1cm4gZGl2O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENhbGxiYWNrIGludm9rZWQgd2l0aCB0ZXh0L3BsYWluIHZlcnNpb24gb2YgbWVzc2FnZVxyXG4gKiBAY2FsbGJhY2sgb3JnX29wZW5fc3dfcGdwLl9wcm9jZXNzTXNnQ0JcclxuICogQHBhcmFtIHtleHRlcm5hbDp6aW1icmFNYWlsLm1haWwudmlldy5abUNvbnZWaWV3MnxleHRlcm5hbDp6aW1icmFNYWlsLm1haWwudmlldy5abU1haWxNc2dWaWV3fSB2aWV3IC0gQ29udmVyc2F0aW9uIG9yIG1haWwgbWVzc2FnZSB2aWV3XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBtc2dJZCAtIFppbWJyYSBtZXNzYWdlIGlkXHJcbiAqIEBwYXJhbSB7ZXh0ZXJuYWw6emltYnJhTWFpbC5tYWlsLm1vZGVsLlptTWltZVBhcnR9IGJvZHlQYXJ0IC0gTUlNRSBwYXJ0IHdpdGggdGV4dC9wbGFpbiBib2R5XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9wcm9jZXNzTXNnQ0IgPSBmdW5jdGlvbiAodmlldywgbXNnSWQsIGJvZHlQYXJ0KSB7XHJcblx0aWYgKGJvZHlQYXJ0KSB7XHJcblx0XHR2YXIgbXNnVGV4dCA9IGJvZHlQYXJ0LmdldENvbnRlbnQoKTtcclxuXHJcblx0XHRpZiAobXNnVGV4dC5tYXRjaCgvXi0tLS0tQkVHSU4gKC4qKS0tLS0tJC9tKSkge1xyXG5cdFx0XHR2YXIgZGl2ID0gdGhpcy5fZ2V0SW5mb0JhckRpdih2aWV3KTtcclxuXHRcdFx0dmFyIG1zZ0NvbnRleHQgPSB7IGRpdklkOmRpdi5pZCwgbWFpbE1zZ0lkOiBtc2dJZCB9O1xyXG5cclxuXHRcdFx0Ly8gUGFyc2Ugb3V0IG91ciBzaWduYXR1cmUgc3R1ZmYgYW5kIG1lc3NhZ2UgdGV4dFxyXG5cdFx0XHRtc2dDb250ZXh0LmNsZWFydGV4dCA9IG9wZW5wZ3AuY2xlYXJ0ZXh0LnJlYWRBcm1vcmVkKG1zZ1RleHQpO1xyXG5cclxuXHRcdFx0aWYgKG1zZ0NvbnRleHQuY2xlYXJ0ZXh0KSB7XHJcblx0XHRcdFx0dGhpcy5fZGlzcGxheVZlcmlmeUJhcihtc2dDb250ZXh0KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9kaXNwbGF5UmVzdWx0QmFyKG1zZ0NvbnRleHQsIGZhbHNlLCAndW5rbm93bicsICd1bmtub3duJywgJ0Vycm9yIHBhcnNpbmcgbWVzc2FnZScpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodGhpcy50ZXN0TW9kZSkge1xyXG5cdFx0XHRcdHRoaXMuX3NlYXJjaEZvcktleShtc2dDb250ZXh0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBTZWFyY2hlcyBjYWNoZSBmb3Iga2V5LCBpZiBub3QgZm91bmQsIGFzayBhYm91dCBnb2luZyBvbmxpbmVcclxuICogQHBhcmFtIHtvcmdfb3Blbl9zd19wZ3AubWVzc2FnZUNvbnRleHR9IG1zZ0NvbnRleHQgLSBDb250ZXh0IGZvciBwcm9jZXNzaW5nIFppbWJyYSBtYWlsIG1lc3NhZ2VcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX3NlYXJjaEZvcktleSA9IGZ1bmN0aW9uIChtc2dDb250ZXh0KSB7XHJcblx0bXNnQ29udGV4dC5rZXlMaXN0ID0gW107XHJcblx0bXNnQ29udGV4dC5rZXlJZExpc3QgPSBbXTtcclxuXHR2YXIga2V5SWRMaXN0ID0gbXNnQ29udGV4dC5jbGVhcnRleHQuZ2V0U2lnbmluZ0tleUlkcygpO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwga2V5SWRMaXN0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHR2YXIga2V5SWQgPSBvcGVucGdwLnV0aWwuaGV4c3RyZHVtcChrZXlJZExpc3RbaV0ud3JpdGUoKSk7XHJcblx0XHR2YXIgcHVibGljS2V5TGlzdCA9IHRoaXMua2V5cmluZy5nZXRLZXlzRm9yS2V5SWQoa2V5SWQpO1xyXG5cdFx0aWYgKHB1YmxpY0tleUxpc3QgJiYgcHVibGljS2V5TGlzdC5sZW5ndGggPiAwKSB7XHJcblx0XHRcdG1zZ0NvbnRleHQua2V5TGlzdCA9IG1zZ0NvbnRleHQua2V5TGlzdC5jb25jYXQocHVibGljS2V5TGlzdCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtc2dDb250ZXh0LmtleUlkTGlzdC5wdXNoKGtleUlkKTtcclxuXHRcdH1cclxuXHR9XHJcblx0aWYgKG1zZ0NvbnRleHQua2V5TGlzdC5sZW5ndGggPiAwKSB7XHJcblx0XHQvLyBJZiB0aGlzIGtleSBpcyBmb3VuZCBpbiB0aGUgY2FjaGVcclxuXHRcdHRoaXMuX21zZ1ZlcmlmeShtc2dDb250ZXh0KTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0aWYgKCF0aGlzLnRlc3RNb2RlKSB7XHJcblx0XHRcdC8vIE90aGVyd2lzZSwgYXNrIGFib3V0IGdvaW5nIG9ubGluZVxyXG5cdFx0XHR2YXIgZGlhbG9nID0gYXBwQ3R4dC5nZXRZZXNOb01zZ0RpYWxvZygpOyBcclxuXHRcdFx0dmFyIGVyck1zZyA9IFwiQ291bGQgbm90IGZpbmQgcHVibGljIGtleSBpbiB0aGUgY2FjaGUsIHNlYXJjaCBwZ3AubWl0LmVkdSBmb3IgaXQ/XCI7XHJcblx0XHRcdHZhciBzdHlsZSA9IER3dE1lc3NhZ2VEaWFsb2cuSU5GT19TVFlMRTtcclxuXHJcblx0XHRcdGRpYWxvZy5zZXRCdXR0b25MaXN0ZW5lcihEd3REaWFsb2cuWUVTX0JVVFRPTiwgbmV3IEFqeExpc3RlbmVyKHRoaXMsIHRoaXMuX3NlYXJjaEJ0bkxpc3RlbmVyLCBtc2dDb250ZXh0KSk7XHJcblx0XHRcdGRpYWxvZy5zZXRCdXR0b25MaXN0ZW5lcihEd3REaWFsb2cuTk9fQlVUVE9OLCBuZXcgQWp4TGlzdGVuZXIodGhpcywgdGhpcy5fZGlhbG9nQ2xvc2VMaXN0ZW5lcikpO1xyXG5cclxuXHRcdFx0ZGlhbG9nLnJlc2V0KCk7XHJcblx0XHRcdGRpYWxvZy5zZXRNZXNzYWdlKGVyck1zZywgc3R5bGUpO1xyXG5cdFx0XHRkaWFsb2cucG9wdXAoKTtcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogRXZlbnQgaGFuZGxlciBmb3Igc2VhcmNoIGludGVybmV0IGZvciBrZXlcclxuICogQGNhbGxiYWNrIG9yZ19vcGVuX3N3X3BncC5fc2VhcmNoQnRuTGlzdGVuZXJcclxuICogQHBhcmFtIHtvcmdfb3Blbl9zd19wZ3AubWVzc2FnZUNvbnRleHR9IG1zZ0NvbnRleHQgLSBDb250ZXh0IGZvciBwcm9jZXNzaW5nIFppbWJyYSBtYWlsIG1lc3NhZ2VcclxuICogQHBhcmFtIHtleHRlcm5hbDphamF4LmR3dC5ldmVudHMuRHd0U2VsZWN0aW9uRXZlbnR9IGV2ZW50b2JqIC0gQWpheCBzZWxlY3Rpb24gZXZlbnQgb2JqZWN0XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9zZWFyY2hCdG5MaXN0ZW5lciA9IGZ1bmN0aW9uIChtc2dDb250ZXh0LCBldmVudG9iaikge1xyXG5cdGlmIChldmVudG9iaikge1xyXG5cdFx0ZXZlbnRvYmouaXRlbS5wYXJlbnQucG9wZG93bigpO1xyXG5cdH1cclxuXHJcblx0dmFyIGtleWlkID0gbXNnQ29udGV4dC5rZXlJZExpc3RbMF07XHJcblx0dmFyIHJlc3BvbnNlID0gQWp4UnBjLmludm9rZShudWxsLCAnL3NlcnZpY2UvemltbGV0L29yZ19vcGVuX3N3X3BncC9sb29rdXAuanNwP2tleT0weCcra2V5aWQsIG51bGwsIG51bGwsIHRydWUpO1xyXG5cdC8vIElmIHdlIGRvbid0IGhhdmUgYSBudWxsIHJlc3BvbnNlXHJcblx0aWYgKHJlc3BvbnNlLnRleHQgIT09IFwiXCIgJiYgcmVzcG9uc2UudHh0ICE9PSBcIk5vIGVtYWlsIHNwZWNpZmllZFwiKSB7XHJcblx0XHQvLyBJZiB0aGUga2V5IHdhcyBmb3VuZCwgXHJcblx0XHQvLyBDcmVhdGUgYSBuZXcgdGVtcG9yYXJ5IGRpdiB0byBwb3B1bGF0ZSB3aXRoIG91ciByZXNwb25zZSBzbyB3ZSBjYW4gbmF2aWdhdGUgaXQgZWFzaWVyLCBhbmQgaGlkZSBpdC5cclxuXHRcdHZhciB0ZW1wX2RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0dGVtcF9kaXYuaW5uZXJIVE1MID0gcmVzcG9uc2UudGV4dDtcclxuXHRcdHZhciBrZXl0ZXh0ID0gdGVtcF9kaXYuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3ByZScpWzBdLmlubmVySFRNTDtcclxuXHRcdHRoaXMua2V5cmluZy5pbXBvcnRLZXkoa2V5dGV4dCk7XHJcblx0XHR0aGlzLl9tc2dWZXJpZnkobXNnQ29udGV4dCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIElmIG5vIGtleSB3YXMgZm91bmQsIGVycm9yIG91dCBhbmQgZGlzcGxheSB0aGUgcHJvYmxlbS4gXHJcblx0XHQvLyBXaWxsIHVwZGF0ZSBzbyBtYW51YWwga2V5IGVudHJ5IGlzIHBvc3NpYmxlIGxhdGVyLiBcclxuXHRcdHZhciBkaWFsb2cgPSBhcHBDdHh0LmdldFllc05vTXNnRGlhbG9nKCk7IFxyXG5cdFx0dmFyIGVyck1zZyA9IFwiQ291bGQgbm90IGZpbmQgdGhlIGtleSBvbiBwZ3AubWl0LmVkdSwgZW50ZXIgaXQgbWFudWFsbHk/XCI7XHJcblx0XHR2YXIgc3R5bGUgPSBEd3RNZXNzYWdlRGlhbG9nLklORk9fU1RZTEU7XHJcblxyXG5cdFx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5ZRVNfQlVUVE9OLCBuZXcgQWp4TGlzdGVuZXIodGhpcywgX21hbnVhbEtleUVudHJ5LCBtc2dDb250ZXh0KSk7XHJcblx0XHRkaWFsb2cuc2V0QnV0dG9uTGlzdGVuZXIoRHd0RGlhbG9nLk5PX0JVVFRPTiwgbmV3IEFqeExpc3RlbmVyKHRoaXMsIF9kaWFsb2dDbG9zZUxpc3RlbmVyKSk7XHJcblxyXG5cdFx0ZGlhbG9nLnJlc2V0KCk7XHJcblx0XHRkaWFsb2cuc2V0TWVzc2FnZShlcnJNc2csIHN0eWxlKTtcclxuXHRcdGRpYWxvZy5wb3B1cCgpO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBEaXNwbGF5IGRpYWxvZyBmb3IgbWFudWFsIGtleSBpbXBvcnRcclxuICogQGNhbGxiYWNrIG9yZ19vcGVuX3N3X3BncC5fbWFudWFsS2V5RW50cnlcclxuICogQHBhcmFtIHtvcmdfb3Blbl9zd19wZ3AubWVzc2FnZUNvbnRleHR9IG1zZ0NvbnRleHQgLSBDb250ZXh0IGZvciBwcm9jZXNzaW5nIFppbWJyYSBtYWlsIG1lc3NhZ2VcclxuICogQHBhcmFtIHtleHRlcm5hbDphamF4LmR3dC5ldmVudHMuRHd0U2VsZWN0aW9uRXZlbnR9IGV2ZW50b2JqIC0gQWpheCBzZWxlY3Rpb24gZXZlbnQgb2JqZWN0XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9tYW51YWxLZXlFbnRyeSA9IGZ1bmN0aW9uIChtc2dDb250ZXh0LCBldmVudG9iaikge1xyXG5cdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHJcblx0dmFyIEhUTUwgPVx0JzxkaXYgaWQ9XCJrZXlFbnRyeURpdlwiPicgK1xyXG5cdFx0XHRcdFx0Jzx0ZXh0YXJlYSBpZD1cImtleUVudHJ5VGV4dGFyZWFcIj48L3RleHRhcmVhPicgK1xyXG5cdFx0XHRcdCc8L2Rpdj4nO1xyXG5cclxuXHR2YXIgc0RpYWxvZ1RpdGxlID0gXCI8Y2VudGVyPkVudGVyIGluIHRoZSBwdWJsaWMga2V5IGFuZCBwcmVzcyBcXFwiT0tcXFwiPC9jZW50ZXI+XCI7XHJcblxyXG5cdHZhciB2aWV3ID0gbmV3IER3dENvbXBvc2l0ZShhcHBDdHh0LmdldFNoZWxsKCkpO1xyXG5cdHZpZXcuc2V0U2l6ZShcIjUwMFwiLCBcIjUwMFwiKTsgXHJcblx0dmlldy5nZXRIdG1sRWxlbWVudCgpLnN0eWxlLm92ZXJmbG93ID0gXCJhdXRvXCI7XHJcblx0dmlldy5nZXRIdG1sRWxlbWVudCgpLmlubmVySFRNTCA9IEhUTUw7XHJcblxyXG5cdC8vIHBhc3MgdGhlIHRpdGxlLCB2aWV3ICYgYnV0dG9ucyBpbmZvcm1hdGlvbiB0byBjcmVhdGUgZGlhbG9nIGJveFxyXG5cdHZhciBkaWFsb2cgPSBuZXcgWm1EaWFsb2coe3RpdGxlOnNEaWFsb2dUaXRsZSwgdmlldzp2aWV3LCBwYXJlbnQ6YXBwQ3R4dC5nZXRTaGVsbCgpLCBzdGFuZGFyZEJ1dHRvbnM6W0R3dERpYWxvZy5PS19CVVRUT05dfSk7XHJcblx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5PS19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCB0aGlzLl9yZWFkS2V5TGlzdGVuZXIsIG1zZ0NvbnRleHQpKTtcclxuXHRkaWFsb2cucG9wdXAoKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBFdmVudCBoYW5kbGVyIGZvciBpbXBvcnQga2V5XHJcbiAqIEBjYWxsYmFjayBvcmdfb3Blbl9zd19wZ3AuX3JlYWRLZXlMaXN0ZW5lclxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOmFqYXguZHd0LmV2ZW50cy5Ed3RTZWxlY3Rpb25FdmVudH0gZXZlbnRvYmogLSBBamF4IHNlbGVjdGlvbiBldmVudCBvYmplY3RcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX3JlYWRLZXlMaXN0ZW5lciA9IGZ1bmN0aW9uIChtc2dDb250ZXh0LCBldmVudG9iaikge1xyXG5cdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHJcblx0Ly8gR2V0IG91ciBrZXkgcGFzdGVkIGluLCBhbmQgY2xlYXIgb3VyIHRoZSBlbnRyeSBpbiB0aGUgRE9NXHJcblx0dmFyIHBncEtleSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdrZXlFbnRyeVRleHRhcmVhJykudmFsdWU7XHJcblx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2tleUVudHJ5VGV4dGFyZWEnKS52YWx1ZSA9IFwiXCI7XHJcblx0dGhpcy5rZXlyaW5nLmltcG9ydEtleShwZ3BLZXkpO1xyXG5cdHRoaXMuX21zZ1ZlcmlmeShtc2dDb250ZXh0KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBWZXJpZnkgbWFpbCBtZXNzYWdlIHNpZ25hdHVyZVxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fbXNnVmVyaWZ5ID0gZnVuY3Rpb24gKG1zZ0NvbnRleHQpIHtcclxuXHR2YXIgaW5kZXg7XHJcblxyXG5cdGlmIChtc2dDb250ZXh0LmtleUxpc3QubGVuZ3RoID09PSAwKSB7XHJcblx0XHR2YXIga2V5SWRMaXN0ID0gbXNnQ29udGV4dC5jbGVhcnRleHQuZ2V0U2lnbmluZ0tleUlkcygpO1xyXG5cdFx0Zm9yIChpbmRleCA9IDA7IGluZGV4IDwga2V5SWRMaXN0Lmxlbmd0aDsgaW5kZXgrKykge1xyXG5cdFx0XHR2YXIgcHVibGljS2V5TGlzdCA9IHRoaXMua2V5cmluZy5nZXRLZXlzRm9yS2V5SWQob3BlbnBncC51dGlsLmhleHN0cmR1bXAoa2V5SWRMaXN0W2luZGV4XS53cml0ZSgpKSk7XHJcblx0XHRcdGlmIChwdWJsaWNLZXlMaXN0ICE9PSBudWxsICYmIHB1YmxpY0tleUxpc3QubGVuZ3RoID4gMCkge1xyXG5cdFx0XHRcdG1zZ0NvbnRleHQua2V5TGlzdCA9IG1zZ0NvbnRleHQua2V5TGlzdC5jb25jYXQocHVibGljS2V5TGlzdCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciByZXN1bHQgPSBmYWxzZTtcclxuXHR2YXIgaWQgPSBcIjB4XCIgKyBvcGVucGdwLnV0aWwuaGV4c3RyZHVtcChtc2dDb250ZXh0LmtleUxpc3RbMF0uZ2V0S2V5SWRzKClbMF0ud3JpdGUoKSkuc3Vic3RyaW5nKDgpO1xyXG5cdHZhciB1c2VyID0gbXNnQ29udGV4dC5rZXlMaXN0WzBdLmdldFVzZXJJZHMoKVswXTtcclxuXHJcblx0dmFyIHZlcmlmeVJlc3VsdCA9IG1zZ0NvbnRleHQuY2xlYXJ0ZXh0LnZlcmlmeShtc2dDb250ZXh0LmtleUxpc3QpO1xyXG5cdGlmICh2ZXJpZnlSZXN1bHQpIHtcclxuXHRcdGZvciAoaW5kZXggPSAwOyBpbmRleCA8IHZlcmlmeVJlc3VsdC5sZW5ndGg7IGluZGV4KyspIHtcclxuXHRcdFx0aWYgKHZlcmlmeVJlc3VsdFtpbmRleF0udmFsaWQpIHtcclxuXHRcdFx0XHRyZXN1bHQgPSB0cnVlO1xyXG5cdFx0XHRcdGlkID0gXCIweFwiICsgb3BlbnBncC51dGlsLmhleHN0cmR1bXAodmVyaWZ5UmVzdWx0W2luZGV4XS5rZXlpZC53cml0ZSgpKS5zdWJzdHJpbmcoOCk7XHJcblx0XHRcdFx0dXNlciA9IG1zZ0NvbnRleHQua2V5TGlzdFtpbmRleF0uZ2V0VXNlcklkcygpWzBdO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR0aGlzLl9kaXNwbGF5UmVzdWx0QmFyKG1zZ0NvbnRleHQsIHJlc3VsdCwgaWQsIHVzZXIpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSBjYWNoZWQgcmVzdWx0IGh0bWwgZm9yIHByZXZpb3VzbHkgdmVyaWZpZWQgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbXNnSWQgLSBaaW1icmEgbWFpbCBtZXNzYWdlIGlkXHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9yZW1vdmVGcm9tVGVtcENhY2hlID0gZnVuY3Rpb24gKG1zZ0lkKSB7XHJcblx0Ly8gSWYgd2UgaGF2ZSB0aGUgbmVjZXNzYXJ5IHNlc3Npb25TdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0c2Vzc2lvblN0b3JhZ2UucmVtb3ZlSXRlbShtc2dJZCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIEJ5IGRlZmF1bHQgY29va2llcyBhcmUgYWxsIHNlc3Npb25cclxuXHRcdGRvY3VtZW50LmNvb2tpZS5yZW1vdmVJdGVtKCdQR1BWZXJpZmllZF8nICsgbXNnSWQpO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdG9yZSBjYWNoZWQgcmVzdWx0IGh0bWwgZm9yIHByZXZpb3VzbHkgdmVyaWZpZWQgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbXNnSWQgLSBaaW1icmEgbWFpbCBtZXNzYWdlIGlkXHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9zdG9yZUluVGVtcENhY2hlID0gZnVuY3Rpb24gKG1zZ0lkLCBIVE1MKSB7XHJcblx0Ly8gSWYgd2UgaGF2ZSB0aGUgbmVjZXNzYXJ5IHNlc3Npb25TdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0c2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbShtc2dJZCwgZXNjYXBlKEhUTUwpKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly8gQnkgZGVmYXVsdCBjb29raWVzIGFyZSBhbGwgc2Vzc2lvblxyXG5cdFx0ZG9jdW1lbnQuY29va2llID0gJ1BHUFZlcmlmaWVkXycgKyBtc2dJZCArJz0nKyBlc2NhcGUoSFRNTCk7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBjYWNoZWQgcmVzdWx0IGh0bWwgZm9yIHByZXZpb3VzbHkgdmVyaWZpZWQgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbXNnSWQgLSBaaW1icmEgbWFpbCBtZXNzYWdlIGlkXHJcbiAqIEByZXR1cm4ge3N0cmluZ30gcmVzdWx0IGh0bWxcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2dldEZyb21UZW1wQ2FjaGUgPSBmdW5jdGlvbiAobXNnSWQpIHtcclxuXHQvLyBJZiB3ZSBoYXZlIHRoZSBuZWNlc3NhcnkgbG9jYWxTdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0bXNnSFRNTCA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0obXNnSWQpO1xyXG5cdFx0aWYgKG1zZ0hUTUwgIT09IG51bGwpIHtcclxuXHRcdFx0bXNnSFRNTCA9IHVuZXNjYXBlKG1zZ0hUTUwpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG1zZ0hUTUw7XHJcblx0fSBlbHNlIHtcclxuXHRcdHZhciBjb29raWVzID0gZG9jdW1lbnQuY29va2llLnNwbGl0KCc7Jyk7XHJcblx0XHR2YXIgcGdwQ29va2llcyA9IFtdO1xyXG5cdFx0Zm9yIChpPTA7aTxjb29raWVzLmxlbmd0aDtpKyspIHtcclxuXHRcdFx0Ly8gUG9wdWxhdGUgb3VyIHBncENvb2tpZXMgYXJyYXkgd2l0aCB0aGUgcG9pbnRlcnMgdG8gdGhlIGNvb2tpZXMgd2Ugd2FudFxyXG5cdFx0XHRpZiAoY29va2llc1tpXS5pbmRleE9mKCdQR1BWZXJpZmllZF8nKSAhPSAtMSkge1xyXG5cdFx0XHRcdHBncENvb2tpZXMucHVzaChpKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0Ly8gRm9yIGVhY2ggUEdQIGNvb2tpZVxyXG5cdFx0Zm9yIChpPTA7aTxwZ3BDb29raWVzLmxlbmd0aDtpKyspIHsgICAgIFxyXG5cdFx0XHRpZiAoY29va2llc1twZ3BDb29raWVzW2ldXS5yZXBsYWNlKC9eXFxzLywnJykuc3BsaXQoJz0nKVswXSA9PT0gXCJQR1BWZXJpZmllZF9cIiArIG1zZ0lkKSB7XHJcblx0XHRcdFx0Ly8gRGVsaWNpb3VzIGNvb2tpZXNcclxuXHRcdFx0XHRtc2dIVE1MID0gdW5lc2NhcGUoY29va2llc1twZ3BDb29raWVzW2ldXS5yZXBsYWNlKC9eXFxzLywnJykuc3BsaXQoJz0nKVsxXSk7XHJcblx0XHRcdFx0cmV0dXJuIG1zZ0hUTUw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH0gICAgXHJcbn07XHJcblxyXG4vKipcclxuICogRGlzcGxheSBiYXIgaW5kaWNhdGluZyBtZXNzYWdlIHNpZ25lZFxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4gKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fZGlzcGxheVZlcmlmeUJhciA9IGZ1bmN0aW9uIChtc2dDb250ZXh0KSB7XHJcblx0dmFyIHZhbHVlcyA9IHtcclxuXHRcdGxvZ286IHRoaXMuZ2V0UmVzb3VyY2UoJ3BncC5wbmcnKSxcclxuXHRcdGluZm9CYXJEaXZJZDogbXNnQ29udGV4dC5kaXZJZFxyXG5cdH07XHJcblx0dmFyIHppbWxldCA9IHRoaXM7XHJcblx0dmFyIGRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1zZ0NvbnRleHQuZGl2SWQpO1xyXG5cclxuXHRkaXYuaW5uZXJIVE1MID0gQWp4VGVtcGxhdGUuZXhwYW5kKFwib3JnX29wZW5fc3dfcGdwLnRlbXBsYXRlcy5wZ3AjaW5mb2Jhcl92ZXJpZnlcIiwgdmFsdWVzKTtcclxuXHJcblx0YnV0dG9ucyA9IGRpdi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwidmVyaWZ5QnV0dG9uXCIpO1xyXG5cdGJ1dHRvbnNbMF0ub25jbGljayA9IGZ1bmN0aW9uICgpIHsgemltbGV0Ll9zZWFyY2hGb3JLZXkobXNnQ29udGV4dCk7IH07XHJcblxyXG5cdGJ1dHRvbnMgPSBkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImVzY2FwZUJ1dHRvblwiKTtcclxuXHRidXR0b25zWzBdLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7IHppbWxldC5fZGVzdHJveUluZm9CYXIobXNnQ29udGV4dCk7IH07XHJcbn07XHJcblxyXG4vKipcclxuICogRGlzcGxheSBzaWduYXR1cmUgdmVyaWZpY2F0aW9uIHJlc3VsdFxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IHN1Y2NlZWRlZCAtIFRydWUgaWYgc2lnbmF0dXJlIHZlcmlmaWVkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXlJZCAtIElkIG9mIGtleSB1c2VkIHRvIHZlcmlmeSBtZXNzYWdlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB1c2VyIC0gVXNlciB3aGljaCBvd25zIGtleSB1c2VkIHRvIHZlcmlmeSBtZXNzYWdlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBbbXNnXSAtIEN1c3RvbSBmYWlsdXJlIG1lc3NhZ2VcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2Rpc3BsYXlSZXN1bHRCYXIgPSBmdW5jdGlvbiAobXNnQ29udGV4dCwgc3VjY2VlZGVkLCBrZXlJZCwgdXNlciwgbXNnKSB7XHJcblx0dXNlciA9IHVzZXIucmVwbGFjZSgnPCcsJyZsdDsnKS5yZXBsYWNlKCc+JywnJmd0OycpO1xyXG5cclxuXHRpZiAoIW1zZykge1xyXG5cdFx0bXNnID0gc3VjY2VlZGVkID8gJ3ZlcmlmaWVkIHN1Y2Nlc3NmdWxseSEnIDogJypOT1QqIHZlcmlmaWVkISc7XHJcblx0fVxyXG5cclxuXHR2YXIgdmFsdWVzID0ge1xyXG5cdFx0bG9nbzogdGhpcy5nZXRSZXNvdXJjZSgncGdwLnBuZycpLFxyXG5cdFx0Y2xhc3NOYW1lOiBzdWNjZWVkZWQgPyAnc3VjY2VzcycgOiAnZmFpbCcsXHJcblx0XHRpZDoga2V5SWQsXHJcblx0XHR1c2VyOiB1c2VyLFxyXG5cdFx0bXNnOiBtc2csXHJcblx0XHRpbmZvQmFyRGl2SWQ6IG1zZ0NvbnRleHQuZGl2SWRcclxuXHR9O1xyXG5cdHZhciB6aW1sZXQgPSB0aGlzO1xyXG5cdHZhciBkaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtc2dDb250ZXh0LmRpdklkKTtcclxuXHJcblx0ZGl2LmlubmVySFRNTCA9IEFqeFRlbXBsYXRlLmV4cGFuZChcIm9yZ19vcGVuX3N3X3BncC50ZW1wbGF0ZXMucGdwI2luZm9iYXJfcmVzdWx0XCIsIHZhbHVlcyk7XHJcblxyXG5cdGJ1dHRvbnMgPSBkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImVzY2FwZUJ1dHRvblwiKTtcclxuXHRidXR0b25zWzBdLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7IHppbWxldC5fZGVzdHJveUluZm9CYXIobXNnQ29udGV4dCk7IH07XHJcblxyXG5cdHRoaXMuX3N0b3JlSW5UZW1wQ2FjaGUobXNnQ29udGV4dC5tYWlsTXNnSWQsIGRpdi5pbm5lckhUTUwpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEV2ZW50IGhhbmRsZXIgZm9yIGluZm8gYmFyIGNsb3NlIGJ1dHRvblxyXG4gKiBAY2FsbGJhY2sgb3JnX29wZW5fc3dfcGdwLl9kZXN0cm95SW5mb0JhclxyXG4gKiBAcGFyYW0ge29yZ19vcGVuX3N3X3BncC5tZXNzYWdlQ29udGV4dH0gbXNnQ29udGV4dCAtIENvbnRleHQgZm9yIHByb2Nlc3NpbmcgWmltYnJhIG1haWwgbWVzc2FnZVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9kZXN0cm95SW5mb0JhciA9IGZ1bmN0aW9uIChtc2dDb250ZXh0KSB7XHJcblx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobXNnQ29udGV4dC5kaXZJZCkuaW5uZXJIVE1MID0gXCJcIjtcclxuXHR0aGlzLl9yZW1vdmVGcm9tVGVtcENhY2hlKG1zZ0NvbnRleHQubWFpbE1zZ0lkKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBFdmVudCBoYW5kbGVyIGZvciBjbG9zZSBidXR0b25cclxuICogQGNhbGxiYWNrIG9yZ19vcGVuX3N3X3BncC5fZGlhbG9nQ2xvc2VMaXN0ZW5lclxyXG4gKiBAcGFyYW0ge2V4dGVybmFsOmFqYXguZHd0LmV2ZW50cy5Ed3RTZWxlY3Rpb25FdmVudH0gZXZlbnRvYmogLSBBamF4IHNlbGVjdGlvbiBldmVudCBvYmplY3RcclxuICovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2RpYWxvZ0Nsb3NlTGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnRvYmopIHtcclxuXHRpZiAoZXZlbnRvYmopIHtcclxuXHRcdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHR9XHJcbn07XHJcbi8qKlxyXG4gKiBUaGlzIG1ldGhvZCBnZXRzIGNhbGxlZCBieSB0aGUgWmltbGV0IGZyYW1ld29yayB3aGVuIHRoZSBhcHBsaWNhdGlvbiBpcyBvcGVuZWQgZm9yIHRoZSBmaXJzdCB0aW1lLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gYXBwTmFtZSAtIFRoZSBhcHBsaWNhdGlvbiBuYW1lXHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLmFwcExhdW5jaCA9IGZ1bmN0aW9uKGFwcE5hbWUpIHtcclxuXHRzd2l0Y2ggKGFwcE5hbWUpIHtcclxuXHRcdGNhc2UgdGhpcy5fa2V5cmluZ1RhYkFwcE5hbWU6IHtcclxuXHRcdFx0dmFyIGFwcCA9IGFwcEN0eHQuZ2V0QXBwKGFwcE5hbWUpOyAvLyBnZXQgYWNjZXNzIHRvIFptWmltbGV0QXBwXHJcblxyXG5cdFx0XHR2YXIgY29udGVudCA9IHRoaXMuX2NyZWF0ZVRhYlZpZXcoKTtcclxuXHRcdFx0YXBwLnNldENvbnRlbnQoY29udGVudCk7IC8vIHdyaXRlIEhUTUwgdG8gYXBwbGljYXRpb24gdGFiXHJcblxyXG5cdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyB0aGUgdGFiIHZpZXcgdXNpbmcgdGhlIHRlbXBsYXRlLlxyXG4gKlxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IFRoZSB0YWIgSFRNTCBjb250ZW50XHJcbiAqL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9jcmVhdGVUYWJWaWV3ID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gIEFqeFRlbXBsYXRlLmV4cGFuZChcIm9yZ19vcGVuX3N3X3BncC50ZW1wbGF0ZXMucGdwI2tleXJpbmdfdGFiXCIpO1xyXG59O1xyXG4iXX0=
(1)
});
;