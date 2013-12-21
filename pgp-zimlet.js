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
 * Called by Zimbra when a new mail message is shown
 * @param {external:zimbraMail.mail.model.ZmMailMsg} msg - New message
 * @param {external:zimbraMail.mail.model.ZmMailMsg} oldMsg - Previous message
 * @param {external:zimbraMail.mail.view.ZmMailMsgView} view - Mail message view
 */
org_open_sw_pgp.prototype.onMsgView = function (msg, oldMsg, view) {
	var html = this._getFromTempCache(msg.id);

	if (html) {
		var div = this._getInfoBarDiv(view);

		// Make the bar visible
		div.innerHTML = html;

		var msgContext = {
			divId: div.id,
			mailMsgId: msg.id
		};
		var zimlet = this;
		var buttons = div.getElementsByClassName("escapeButton");
		buttons[0].onclick = function () { zimlet._destroyInfoBar(msgContext); };
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
		closeButton: this.getResource('pgp-close.png'),
		okayButton: this.getResource('pgp-okay.png'),
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
		closeButton: this.getResource('pgp-close.png'),
		okayButton: this.getResource('pgp-okay.png'),
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
