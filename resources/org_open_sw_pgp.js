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

/*
===== Declare a blank constructor, since we don't need one =====
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

/*
===== Build our prototype from our constructor and objectHandler =====
*/
org_open_sw_pgp.prototype = new ZmZimletBase();
org_open_sw_pgp.prototype.constructor = org_open_sw_pgp;

/*
===== Stupid convention, but may be used elsewhere =====
*/
org_open_sw_pgp.prototype.toString = function () {
	return "org_open_sw_pgp";
};

/*
===== Init functions (not needed really) =====
*/
org_open_sw_pgp.prototype.init = function () {
	this.hasLocalStorage = typeof(window.localStorage) == "object";

	//openpgp.config.debug = true;
};

/*
===== Draws our initial info bar with the proper signature algorithm =====
*/
org_open_sw_pgp.prototype.onConvView = function (msg, oldMsg, view) {
	this.processMsg(msg, view);
};

/*
===== Draws our initial info bar with the proper signature algorithm =====
*/
org_open_sw_pgp.prototype.onMsgView = function (msg, oldMsg, view) {
	this.processMsg(msg, view);
};

/*
===== Draws our initial info bar with the proper signature algorithm =====
*/
org_open_sw_pgp.prototype.processMsg = function (msg, view) {
	var elemId = view._htmlElId + '__PGP-Zimlet';

	var div = document.getElementById(elemId);

	if (div) {
		var html = this.getFromTempCache(msg.id);

		if (html) {
			// Make the bar visible
			div.innerHTML = html;
			return;
		}
	}

	// Get the plain text body
	msg.getBodyPart(ZmMimeTable.TEXT_PLAIN, AjxCallback.simpleClosure(this.processMsgCB, this, view, div, msg.id));
};

/*
===== Draws our initial info bar with the proper signature algorithm =====
*/
org_open_sw_pgp.prototype.processMsgCB = function (view, div, msgId, bodyPart) {
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

			var msgInfo = { divId:div.id, mailMsgId: msgId };

			// Parse out our signature stuff and message text
			msgInfo.cleartext = openpgp.cleartext.readArmored(msgText);

			if (msgInfo.cleartext) {
				this.verifyBar(msgInfo);
			} else {
				this.resultBar(msgInfo, false, 'unknown', 'unknown', 'Error parsing message');
			}

			if (this.testMode) {
				this.searchForKey(msgInfo);
			}
		}
	}
};

/*
===== Destroys the info bar =====
*/
org_open_sw_pgp.prototype.destroyInfoBar = function (msgInfo) {
	document.getElementById(msgInfo.divId).innerHTML = "";
	this.removeFromTempCache(msgInfo.mailMsgId);
};


/*
===== Searches cache for key, if not found, ask about going online =====
*/
org_open_sw_pgp.prototype.searchForKey = function (msgInfo) {
	msgInfo.keyList = [];
	msgInfo.keyIdList = [];
	var keyIdList = msgInfo.cleartext.getSigningKeyIds();
	for (var i = 0; i < keyIdList.length; i++) {
		var keyId = openpgp.util.hexstrdump(keyIdList[i].write());
		var publicKeyList = this.keyring.getKeysForKeyId(keyId);
		if (publicKeyList && publicKeyList.length > 0) {
			msgInfo.keyList = msgInfo.keyList.concat(publicKeyList);
		} else {
			msgInfo.keyIdList.push(keyId);
		}
	}
	if (msgInfo.keyList.length > 0) {
		// If this key is found in the cache
		this.msgVerify(msgInfo);
	} else {
		if (!this.testMode) {
			// Otherwise, ask about going online
			var dialog = appCtxt.getYesNoMsgDialog(); 
			var errMsg = "Could not find public key in the cache, search pgp.mit.edu for it?";
			var style = DwtMessageDialog.INFO_STYLE;

			dialog.setButtonListener(DwtDialog.YES_BUTTON, new AjxListener(this, this._searchBtnListener, msgInfo));
			dialog.setButtonListener(DwtDialog.NO_BUTTON, new AjxListener(this, this._dialogCloseListener));

			dialog.reset();
			dialog.setMessage(errMsg, style);
			dialog.popup();
		}
	}
};

/*
===== This searches the internet for a suitable public key =====
*/
org_open_sw_pgp.prototype._searchBtnListener = function (msgInfo, eventobj) {
	if (eventobj) {
		eventobj.item.parent.popdown();
	}

	var keyid = msgInfo.keyIdList[0];
	var response = AjxRpc.invoke(null, '/service/zimlet/org_open_sw_pgp/lookup.jsp?key=0x'+keyid, null, null, true);
	// If we don't have a null response
	if (response.text !== "" && response.txt !== "No email specified") {
		// If the key was found, 
		// Create a new temporary div to populate with our response so we can navigate it easier, and hide it.
		var temp_div = document.createElement('div');
		temp_div.innerHTML = response.text;
		var keytext = temp_div.getElementsByTagName('pre')[0].innerHTML;
		this.keyring.importKey(keytext);
		this.msgVerify(msgInfo);
	} else {
		// If no key was found, error out and display the problem. 
		// Will update so manual key entry is possible later. 
		var dialog = appCtxt.getYesNoMsgDialog(); 
		var errMsg = "Could not find the key on pgp.mit.edu, enter it manually?";
		var style = DwtMessageDialog.INFO_STYLE;

		dialog.setButtonListener(DwtDialog.YES_BUTTON, new AjxListener(this, manualKeyEntry, msgInfo));
		dialog.setButtonListener(DwtDialog.NO_BUTTON, new AjxListener(this, _dialogCloseListener));

		dialog.reset();
		dialog.setMessage(errMsg, style);
		dialog.popup();
	}
};

/*
===== This is the function responsible for the drawing of the manual key entry stuff =====
*/
org_open_sw_pgp.prototype.manualKeyEntry = function (msgInfo, eventobj) {
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
	dialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._readKeyListener, msgInfo));
	dialog.popup();
};

org_open_sw_pgp.prototype._readKeyListener = function (msgInfo, eventobj) {
	eventobj.item.parent.popdown();

	// Get our key pasted in, and clear our the entry in the DOM
	var pgpKey = document.getElementById('keyEntryTextarea').value;
	document.getElementById('keyEntryTextarea').value = "";
	this.keyring.importKey(pgpKey);
	this.msgVerify(msgInfo);
};

/*
===== This is the function responsible for verifying the message itself and calling the proper bar =====
*/
org_open_sw_pgp.prototype.msgVerify = function (msgInfo) {
	var index;

	if (msgInfo.keyList.length === 0) {
		var keyIdList = msgInfo.cleartext.getSigningKeyIds();
		for (index = 0; index < keyIdList.length; index++) {
			var publicKeyList = this.keyring.getKeysForKeyId(openpgp.util.hexstrdump(keyIdList[index].write()));
			if (publicKeyList !== null && publicKeyList.length > 0) {
				msgInfo.keyList = msgInfo.keyList.concat(publicKeyList);
			}
		}
	}

	var result = false;
	var id = "0x" + openpgp.util.hexstrdump(msgInfo.keyList[0].getKeyIds()[0].write()).substring(8);
	var user = msgInfo.keyList[0].getUserIds()[0];

	var verifyResult = msgInfo.cleartext.verify(msgInfo.keyList);
	if (verifyResult) {
		for (index = 0; index < verifyResult.length; index++) {
			if (verifyResult[index].valid) {
				result = true;
				id = "0x" + openpgp.util.hexstrdump(verifyResult[index].keyid.write()).substring(8);
				user = msgInfo.keyList[index].getUserIds()[0];
				break;
			}
		}
	}

	this.resultBar(msgInfo, result, id, user);
};

org_open_sw_pgp.prototype.removeFromTempCache = function (msgId) {
	// If we have the necessary sessionStorage object
	if (this.hasLocalStorage) {
		sessionStorage.removeItem(msgId);
	} else {
		// By default cookies are all session
		document.cookie.removeItem('PGPVerified_' + msgId);
	}
};

org_open_sw_pgp.prototype.storeInTempCache = function (msgId, HTML) {
	// If we have the necessary sessionStorage object
	if (this.hasLocalStorage) {
		sessionStorage.setItem(msgId, escape(HTML));
	} else {
		// By default cookies are all session
		document.cookie = 'PGPVerified_' + msgId +'='+ escape(HTML);
	}
};

org_open_sw_pgp.prototype.getFromTempCache = function (msgId) {
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

/*
===== These change the infoBar stuff to pass/fail verification =====
*/
org_open_sw_pgp.prototype.verifyBar = function (msgInfo) {
	var values = {
		logo: this.getResource('pgp.png'),
		infoBarDivId: msgInfo.divId
	};
	var zimlet = this;
	var div = document.getElementById(msgInfo.divId);

	div.innerHTML = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_verify", values);

	buttons = div.getElementsByClassName("verifyButton");
	buttons[0].onclick = function () { zimlet.searchForKey(msgInfo); };

	buttons = div.getElementsByClassName("escapeButton");
	buttons[0].onclick = function () { zimlet.destroyInfoBar(msgInfo); };
};

/*
===== These change the infoBar stuff to pass/fail verification =====
*/
org_open_sw_pgp.prototype.resultBar = function (msgInfo, succeeded, keyId, user, msg) {
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
		infoBarDivId: msgInfo.divId
	};
	var zimlet = this;
	var div = document.getElementById(msgInfo.divId);

	div.innerHTML = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_result", values);

	buttons = div.getElementsByClassName("escapeButton");
	buttons[0].onclick = function () { zimlet.destroyInfoBar(msgInfo); };
};

org_open_sw_pgp.prototype._dialogCloseListener = function (eventobj) {
	if (eventobj) {
		eventobj.item.parent.popdown();
	}
};

},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9yb2JlcnQvemltYnJhLXBncC9wZ3AtemltbGV0L3BncC16aW1sZXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIvL1widXNlIHN0cmljdFwiO1xyXG5cclxuLypcclxuXHJcblRoaXMgZmlsZSBpcyByZXNwb25zaWJsZSBmb3IgYWxsIHRoZSBaaW1icmEgaW50ZWdyYXRpb24gZnVuY3Rpb25zIGFuZCBldmVyeXRoaW5nXHJcbmVsc2UgdGhhdCdzIGRvbmUgaW4gdGhlIHppbWJyYSBpbnRlcmZhY2VcclxuXHJcblRPRE86XHJcblx0PT4gQnV0dG9uIHRoYXQgbGlua3MgdG8gbXkgR2l0aHViXHJcblx0PT4gSW1wbGVtZW50IG9wdGlvbnMgdmlhIHNldFVzZXJQcm9wZXJ0eSgpIGFuZCBnZXRVc2VyUHJvcGVydHkoKVxyXG5cclxuLy8gTGlzdCBhbGwgcHJvcGVydGllcyBpbiBvYmplY3RcclxucHJvcGVydGllcyA9IGFwcEN0eHQuX3ppbWxldE1nci5fWklNTEVUU19CWV9JRFsnb3JnX29wZW5fc3dfcGdwJ10uX3Byb3BzQnlJZFxyXG5mb3IodmFyIGkgaW4gcHJvcGVydGllcykge1xyXG5cdGlmIChwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KGkpKSB7XHJcblx0XHRjb25zb2xlLmxvZyhpICsgXCIgPSBcIiArIHByb3BlcnRpZXNbaV0udmFsdWUpO1xyXG5cdH1cclxufVxyXG5cclxuXHJcbiovXHJcblxyXG52YXIgb3BlbnBncCA9IHJlcXVpcmUoJ29wZW5wZ3AnKTtcclxuXHJcbi8qXHJcbj09PT09IERlY2xhcmUgYSBibGFuayBjb25zdHJ1Y3Rvciwgc2luY2Ugd2UgZG9uJ3QgbmVlZCBvbmUgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwID0gZnVuY3Rpb24gKHRlc3RNb2RlLCBrZXlyaW5nKSB7XHJcblx0dGhpcy50ZXN0TW9kZSA9IHRlc3RNb2RlID8gdHJ1ZSA6IGZhbHNlO1xyXG5cdHRoaXMua2V5cmluZyA9IGtleXJpbmcgPyBrZXlyaW5nIDogcmVxdWlyZSgna2V5cmluZycpO1xyXG5cdG9wZW5wZ3AudXRpbC5wcmludF9vdXRwdXQgPSBmdW5jdGlvbiAobGV2ZWwsIHN0cikge1xyXG5cdFx0aWYgKCF0aGlzLnRlc3RNb2RlKSB7XHJcblx0XHRcdHZhciBoZWFkZXIgPSBcIlVOS05PV05cIjtcclxuXHRcdFx0c3dpdGNoIChsZXZlbCkge1xyXG5cdFx0XHRcdGNhc2Ugb3BlbnBncC51dGlsLnByaW50TGV2ZWwuZXJyb3I6XHJcblx0XHRcdFx0XHRoZWFkZXIgPSBcIkVSUk9SXCI7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlIG9wZW5wZ3AudXRpbC5wcmludExldmVsLndhcm5pbmc6XHJcblx0XHRcdFx0XHRoZWFkZXIgPSBcIldBUk5JTkdcIjtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2Ugb3BlbnBncC51dGlsLnByaW50TGV2ZWwuaW5mbzpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiSU5GT1wiO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBvcGVucGdwLnV0aWwucHJpbnRMZXZlbC5kZWJ1ZzpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiREVCVUdcIjtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coaGVhZGVyICsgJzogJyArIHN0cik7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH07XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBCdWlsZCBvdXIgcHJvdG90eXBlIGZyb20gb3VyIGNvbnN0cnVjdG9yIGFuZCBvYmplY3RIYW5kbGVyID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUgPSBuZXcgWm1aaW1sZXRCYXNlKCk7XHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBvcmdfb3Blbl9zd19wZ3A7XHJcblxyXG4vKlxyXG49PT09PSBTdHVwaWQgY29udmVudGlvbiwgYnV0IG1heSBiZSB1c2VkIGVsc2V3aGVyZSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xyXG5cdHJldHVybiBcIm9yZ19vcGVuX3N3X3BncFwiO1xyXG59O1xyXG5cclxuLypcclxuPT09PT0gSW5pdCBmdW5jdGlvbnMgKG5vdCBuZWVkZWQgcmVhbGx5KSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XHJcblx0dGhpcy5oYXNMb2NhbFN0b3JhZ2UgPSB0eXBlb2Yod2luZG93LmxvY2FsU3RvcmFnZSkgPT0gXCJvYmplY3RcIjtcclxuXHJcblx0Ly9vcGVucGdwLmNvbmZpZy5kZWJ1ZyA9IHRydWU7XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBEcmF3cyBvdXIgaW5pdGlhbCBpbmZvIGJhciB3aXRoIHRoZSBwcm9wZXIgc2lnbmF0dXJlIGFsZ29yaXRobSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLm9uQ29udlZpZXcgPSBmdW5jdGlvbiAobXNnLCBvbGRNc2csIHZpZXcpIHtcclxuXHR0aGlzLnByb2Nlc3NNc2cobXNnLCB2aWV3KTtcclxufTtcclxuXHJcbi8qXHJcbj09PT09IERyYXdzIG91ciBpbml0aWFsIGluZm8gYmFyIHdpdGggdGhlIHByb3BlciBzaWduYXR1cmUgYWxnb3JpdGhtID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUub25Nc2dWaWV3ID0gZnVuY3Rpb24gKG1zZywgb2xkTXNnLCB2aWV3KSB7XHJcblx0dGhpcy5wcm9jZXNzTXNnKG1zZywgdmlldyk7XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBEcmF3cyBvdXIgaW5pdGlhbCBpbmZvIGJhciB3aXRoIHRoZSBwcm9wZXIgc2lnbmF0dXJlIGFsZ29yaXRobSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnByb2Nlc3NNc2cgPSBmdW5jdGlvbiAobXNnLCB2aWV3KSB7XHJcblx0dmFyIGVsZW1JZCA9IHZpZXcuX2h0bWxFbElkICsgJ19fUEdQLVppbWxldCc7XHJcblxyXG5cdHZhciBkaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbGVtSWQpO1xyXG5cclxuXHRpZiAoZGl2KSB7XHJcblx0XHR2YXIgaHRtbCA9IHRoaXMuZ2V0RnJvbVRlbXBDYWNoZShtc2cuaWQpO1xyXG5cclxuXHRcdGlmIChodG1sKSB7XHJcblx0XHRcdC8vIE1ha2UgdGhlIGJhciB2aXNpYmxlXHJcblx0XHRcdGRpdi5pbm5lckhUTUwgPSBodG1sO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyBHZXQgdGhlIHBsYWluIHRleHQgYm9keVxyXG5cdG1zZy5nZXRCb2R5UGFydChabU1pbWVUYWJsZS5URVhUX1BMQUlOLCBBanhDYWxsYmFjay5zaW1wbGVDbG9zdXJlKHRoaXMucHJvY2Vzc01zZ0NCLCB0aGlzLCB2aWV3LCBkaXYsIG1zZy5pZCkpO1xyXG59O1xyXG5cclxuLypcclxuPT09PT0gRHJhd3Mgb3VyIGluaXRpYWwgaW5mbyBiYXIgd2l0aCB0aGUgcHJvcGVyIHNpZ25hdHVyZSBhbGdvcml0aG0gPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5wcm9jZXNzTXNnQ0IgPSBmdW5jdGlvbiAodmlldywgZGl2LCBtc2dJZCwgYm9keVBhcnQpIHtcclxuXHRpZiAoYm9keVBhcnQpIHtcclxuXHRcdHZhciBtc2dUZXh0ID0gYm9keVBhcnQuZ2V0Q29udGVudCgpO1xyXG5cclxuXHRcdGlmIChtc2dUZXh0Lm1hdGNoKC9eLS0tLS1CRUdJTiAoLiopLS0tLS0kL20pKSB7XHJcblx0XHRcdGlmICghZGl2KSB7XHJcblx0XHRcdFx0dmFyIGJvZHlEaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh2aWV3Ll9tc2dCb2R5RGl2SWQpO1xyXG5cclxuXHRcdFx0XHRkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0XHRcdGRpdi5pZCA9IHZpZXcuX2h0bWxFbElkICsgJ19fUEdQLVppbWxldCc7XHJcblx0XHRcdFx0ZGl2LmNsYXNzTmFtZSA9ICdwZ3BJbmZvQmFyJztcclxuXHJcblx0XHRcdFx0Ym9keURpdi5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShkaXYsIGJvZHlEaXYpO1xyXG5cclxuXHRcdFx0XHRkaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChkaXYuaWQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgbXNnSW5mbyA9IHsgZGl2SWQ6ZGl2LmlkLCBtYWlsTXNnSWQ6IG1zZ0lkIH07XHJcblxyXG5cdFx0XHQvLyBQYXJzZSBvdXQgb3VyIHNpZ25hdHVyZSBzdHVmZiBhbmQgbWVzc2FnZSB0ZXh0XHJcblx0XHRcdG1zZ0luZm8uY2xlYXJ0ZXh0ID0gb3BlbnBncC5jbGVhcnRleHQucmVhZEFybW9yZWQobXNnVGV4dCk7XHJcblxyXG5cdFx0XHRpZiAobXNnSW5mby5jbGVhcnRleHQpIHtcclxuXHRcdFx0XHR0aGlzLnZlcmlmeUJhcihtc2dJbmZvKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLnJlc3VsdEJhcihtc2dJbmZvLCBmYWxzZSwgJ3Vua25vd24nLCAndW5rbm93bicsICdFcnJvciBwYXJzaW5nIG1lc3NhZ2UnKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHRoaXMudGVzdE1vZGUpIHtcclxuXHRcdFx0XHR0aGlzLnNlYXJjaEZvcktleShtc2dJbmZvKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qXHJcbj09PT09IERlc3Ryb3lzIHRoZSBpbmZvIGJhciA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLmRlc3Ryb3lJbmZvQmFyID0gZnVuY3Rpb24gKG1zZ0luZm8pIHtcclxuXHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtc2dJbmZvLmRpdklkKS5pbm5lckhUTUwgPSBcIlwiO1xyXG5cdHRoaXMucmVtb3ZlRnJvbVRlbXBDYWNoZShtc2dJbmZvLm1haWxNc2dJZCk7XHJcbn07XHJcblxyXG5cclxuLypcclxuPT09PT0gU2VhcmNoZXMgY2FjaGUgZm9yIGtleSwgaWYgbm90IGZvdW5kLCBhc2sgYWJvdXQgZ29pbmcgb25saW5lID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuc2VhcmNoRm9yS2V5ID0gZnVuY3Rpb24gKG1zZ0luZm8pIHtcclxuXHRtc2dJbmZvLmtleUxpc3QgPSBbXTtcclxuXHRtc2dJbmZvLmtleUlkTGlzdCA9IFtdO1xyXG5cdHZhciBrZXlJZExpc3QgPSBtc2dJbmZvLmNsZWFydGV4dC5nZXRTaWduaW5nS2V5SWRzKCk7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBrZXlJZExpc3QubGVuZ3RoOyBpKyspIHtcclxuXHRcdHZhciBrZXlJZCA9IG9wZW5wZ3AudXRpbC5oZXhzdHJkdW1wKGtleUlkTGlzdFtpXS53cml0ZSgpKTtcclxuXHRcdHZhciBwdWJsaWNLZXlMaXN0ID0gdGhpcy5rZXlyaW5nLmdldEtleXNGb3JLZXlJZChrZXlJZCk7XHJcblx0XHRpZiAocHVibGljS2V5TGlzdCAmJiBwdWJsaWNLZXlMaXN0Lmxlbmd0aCA+IDApIHtcclxuXHRcdFx0bXNnSW5mby5rZXlMaXN0ID0gbXNnSW5mby5rZXlMaXN0LmNvbmNhdChwdWJsaWNLZXlMaXN0KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG1zZ0luZm8ua2V5SWRMaXN0LnB1c2goa2V5SWQpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRpZiAobXNnSW5mby5rZXlMaXN0Lmxlbmd0aCA+IDApIHtcclxuXHRcdC8vIElmIHRoaXMga2V5IGlzIGZvdW5kIGluIHRoZSBjYWNoZVxyXG5cdFx0dGhpcy5tc2dWZXJpZnkobXNnSW5mbyk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGlmICghdGhpcy50ZXN0TW9kZSkge1xyXG5cdFx0XHQvLyBPdGhlcndpc2UsIGFzayBhYm91dCBnb2luZyBvbmxpbmVcclxuXHRcdFx0dmFyIGRpYWxvZyA9IGFwcEN0eHQuZ2V0WWVzTm9Nc2dEaWFsb2coKTsgXHJcblx0XHRcdHZhciBlcnJNc2cgPSBcIkNvdWxkIG5vdCBmaW5kIHB1YmxpYyBrZXkgaW4gdGhlIGNhY2hlLCBzZWFyY2ggcGdwLm1pdC5lZHUgZm9yIGl0P1wiO1xyXG5cdFx0XHR2YXIgc3R5bGUgPSBEd3RNZXNzYWdlRGlhbG9nLklORk9fU1RZTEU7XHJcblxyXG5cdFx0XHRkaWFsb2cuc2V0QnV0dG9uTGlzdGVuZXIoRHd0RGlhbG9nLllFU19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCB0aGlzLl9zZWFyY2hCdG5MaXN0ZW5lciwgbXNnSW5mbykpO1xyXG5cdFx0XHRkaWFsb2cuc2V0QnV0dG9uTGlzdGVuZXIoRHd0RGlhbG9nLk5PX0JVVFRPTiwgbmV3IEFqeExpc3RlbmVyKHRoaXMsIHRoaXMuX2RpYWxvZ0Nsb3NlTGlzdGVuZXIpKTtcclxuXHJcblx0XHRcdGRpYWxvZy5yZXNldCgpO1xyXG5cdFx0XHRkaWFsb2cuc2V0TWVzc2FnZShlcnJNc2csIHN0eWxlKTtcclxuXHRcdFx0ZGlhbG9nLnBvcHVwKCk7XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5cclxuLypcclxuPT09PT0gVGhpcyBzZWFyY2hlcyB0aGUgaW50ZXJuZXQgZm9yIGEgc3VpdGFibGUgcHVibGljIGtleSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9zZWFyY2hCdG5MaXN0ZW5lciA9IGZ1bmN0aW9uIChtc2dJbmZvLCBldmVudG9iaikge1xyXG5cdGlmIChldmVudG9iaikge1xyXG5cdFx0ZXZlbnRvYmouaXRlbS5wYXJlbnQucG9wZG93bigpO1xyXG5cdH1cclxuXHJcblx0dmFyIGtleWlkID0gbXNnSW5mby5rZXlJZExpc3RbMF07XHJcblx0dmFyIHJlc3BvbnNlID0gQWp4UnBjLmludm9rZShudWxsLCAnL3NlcnZpY2UvemltbGV0L29yZ19vcGVuX3N3X3BncC9sb29rdXAuanNwP2tleT0weCcra2V5aWQsIG51bGwsIG51bGwsIHRydWUpO1xyXG5cdC8vIElmIHdlIGRvbid0IGhhdmUgYSBudWxsIHJlc3BvbnNlXHJcblx0aWYgKHJlc3BvbnNlLnRleHQgIT09IFwiXCIgJiYgcmVzcG9uc2UudHh0ICE9PSBcIk5vIGVtYWlsIHNwZWNpZmllZFwiKSB7XHJcblx0XHQvLyBJZiB0aGUga2V5IHdhcyBmb3VuZCwgXHJcblx0XHQvLyBDcmVhdGUgYSBuZXcgdGVtcG9yYXJ5IGRpdiB0byBwb3B1bGF0ZSB3aXRoIG91ciByZXNwb25zZSBzbyB3ZSBjYW4gbmF2aWdhdGUgaXQgZWFzaWVyLCBhbmQgaGlkZSBpdC5cclxuXHRcdHZhciB0ZW1wX2RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0dGVtcF9kaXYuaW5uZXJIVE1MID0gcmVzcG9uc2UudGV4dDtcclxuXHRcdHZhciBrZXl0ZXh0ID0gdGVtcF9kaXYuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3ByZScpWzBdLmlubmVySFRNTDtcclxuXHRcdHRoaXMua2V5cmluZy5pbXBvcnRLZXkoa2V5dGV4dCk7XHJcblx0XHR0aGlzLm1zZ1ZlcmlmeShtc2dJbmZvKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly8gSWYgbm8ga2V5IHdhcyBmb3VuZCwgZXJyb3Igb3V0IGFuZCBkaXNwbGF5IHRoZSBwcm9ibGVtLiBcclxuXHRcdC8vIFdpbGwgdXBkYXRlIHNvIG1hbnVhbCBrZXkgZW50cnkgaXMgcG9zc2libGUgbGF0ZXIuIFxyXG5cdFx0dmFyIGRpYWxvZyA9IGFwcEN0eHQuZ2V0WWVzTm9Nc2dEaWFsb2coKTsgXHJcblx0XHR2YXIgZXJyTXNnID0gXCJDb3VsZCBub3QgZmluZCB0aGUga2V5IG9uIHBncC5taXQuZWR1LCBlbnRlciBpdCBtYW51YWxseT9cIjtcclxuXHRcdHZhciBzdHlsZSA9IER3dE1lc3NhZ2VEaWFsb2cuSU5GT19TVFlMRTtcclxuXHJcblx0XHRkaWFsb2cuc2V0QnV0dG9uTGlzdGVuZXIoRHd0RGlhbG9nLllFU19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCBtYW51YWxLZXlFbnRyeSwgbXNnSW5mbykpO1xyXG5cdFx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5OT19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCBfZGlhbG9nQ2xvc2VMaXN0ZW5lcikpO1xyXG5cclxuXHRcdGRpYWxvZy5yZXNldCgpO1xyXG5cdFx0ZGlhbG9nLnNldE1lc3NhZ2UoZXJyTXNnLCBzdHlsZSk7XHJcblx0XHRkaWFsb2cucG9wdXAoKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBUaGlzIGlzIHRoZSBmdW5jdGlvbiByZXNwb25zaWJsZSBmb3IgdGhlIGRyYXdpbmcgb2YgdGhlIG1hbnVhbCBrZXkgZW50cnkgc3R1ZmYgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5tYW51YWxLZXlFbnRyeSA9IGZ1bmN0aW9uIChtc2dJbmZvLCBldmVudG9iaikge1xyXG5cdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHJcblx0dmFyIEhUTUwgPVx0JzxkaXYgaWQ9XCJrZXlFbnRyeURpdlwiPicgK1xyXG5cdFx0XHRcdFx0Jzx0ZXh0YXJlYSBpZD1cImtleUVudHJ5VGV4dGFyZWFcIj48L3RleHRhcmVhPicgK1xyXG5cdFx0XHRcdCc8L2Rpdj4nO1xyXG5cclxuXHR2YXIgc0RpYWxvZ1RpdGxlID0gXCI8Y2VudGVyPkVudGVyIGluIHRoZSBwdWJsaWMga2V5IGFuZCBwcmVzcyBcXFwiT0tcXFwiPC9jZW50ZXI+XCI7XHJcblxyXG5cdHZhciB2aWV3ID0gbmV3IER3dENvbXBvc2l0ZShhcHBDdHh0LmdldFNoZWxsKCkpO1xyXG5cdHZpZXcuc2V0U2l6ZShcIjUwMFwiLCBcIjUwMFwiKTsgXHJcblx0dmlldy5nZXRIdG1sRWxlbWVudCgpLnN0eWxlLm92ZXJmbG93ID0gXCJhdXRvXCI7XHJcblx0dmlldy5nZXRIdG1sRWxlbWVudCgpLmlubmVySFRNTCA9IEhUTUw7XHJcblxyXG5cdC8vIHBhc3MgdGhlIHRpdGxlLCB2aWV3ICYgYnV0dG9ucyBpbmZvcm1hdGlvbiB0byBjcmVhdGUgZGlhbG9nIGJveFxyXG5cdHZhciBkaWFsb2cgPSBuZXcgWm1EaWFsb2coe3RpdGxlOnNEaWFsb2dUaXRsZSwgdmlldzp2aWV3LCBwYXJlbnQ6YXBwQ3R4dC5nZXRTaGVsbCgpLCBzdGFuZGFyZEJ1dHRvbnM6W0R3dERpYWxvZy5PS19CVVRUT05dfSk7XHJcblx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5PS19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCB0aGlzLl9yZWFkS2V5TGlzdGVuZXIsIG1zZ0luZm8pKTtcclxuXHRkaWFsb2cucG9wdXAoKTtcclxufTtcclxuXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX3JlYWRLZXlMaXN0ZW5lciA9IGZ1bmN0aW9uIChtc2dJbmZvLCBldmVudG9iaikge1xyXG5cdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHJcblx0Ly8gR2V0IG91ciBrZXkgcGFzdGVkIGluLCBhbmQgY2xlYXIgb3VyIHRoZSBlbnRyeSBpbiB0aGUgRE9NXHJcblx0dmFyIHBncEtleSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdrZXlFbnRyeVRleHRhcmVhJykudmFsdWU7XHJcblx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2tleUVudHJ5VGV4dGFyZWEnKS52YWx1ZSA9IFwiXCI7XHJcblx0dGhpcy5rZXlyaW5nLmltcG9ydEtleShwZ3BLZXkpO1xyXG5cdHRoaXMubXNnVmVyaWZ5KG1zZ0luZm8pO1xyXG59O1xyXG5cclxuLypcclxuPT09PT0gVGhpcyBpcyB0aGUgZnVuY3Rpb24gcmVzcG9uc2libGUgZm9yIHZlcmlmeWluZyB0aGUgbWVzc2FnZSBpdHNlbGYgYW5kIGNhbGxpbmcgdGhlIHByb3BlciBiYXIgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5tc2dWZXJpZnkgPSBmdW5jdGlvbiAobXNnSW5mbykge1xyXG5cdHZhciBpbmRleDtcclxuXHJcblx0aWYgKG1zZ0luZm8ua2V5TGlzdC5sZW5ndGggPT09IDApIHtcclxuXHRcdHZhciBrZXlJZExpc3QgPSBtc2dJbmZvLmNsZWFydGV4dC5nZXRTaWduaW5nS2V5SWRzKCk7XHJcblx0XHRmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBrZXlJZExpc3QubGVuZ3RoOyBpbmRleCsrKSB7XHJcblx0XHRcdHZhciBwdWJsaWNLZXlMaXN0ID0gdGhpcy5rZXlyaW5nLmdldEtleXNGb3JLZXlJZChvcGVucGdwLnV0aWwuaGV4c3RyZHVtcChrZXlJZExpc3RbaW5kZXhdLndyaXRlKCkpKTtcclxuXHRcdFx0aWYgKHB1YmxpY0tleUxpc3QgIT09IG51bGwgJiYgcHVibGljS2V5TGlzdC5sZW5ndGggPiAwKSB7XHJcblx0XHRcdFx0bXNnSW5mby5rZXlMaXN0ID0gbXNnSW5mby5rZXlMaXN0LmNvbmNhdChwdWJsaWNLZXlMaXN0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIHJlc3VsdCA9IGZhbHNlO1xyXG5cdHZhciBpZCA9IFwiMHhcIiArIG9wZW5wZ3AudXRpbC5oZXhzdHJkdW1wKG1zZ0luZm8ua2V5TGlzdFswXS5nZXRLZXlJZHMoKVswXS53cml0ZSgpKS5zdWJzdHJpbmcoOCk7XHJcblx0dmFyIHVzZXIgPSBtc2dJbmZvLmtleUxpc3RbMF0uZ2V0VXNlcklkcygpWzBdO1xyXG5cclxuXHR2YXIgdmVyaWZ5UmVzdWx0ID0gbXNnSW5mby5jbGVhcnRleHQudmVyaWZ5KG1zZ0luZm8ua2V5TGlzdCk7XHJcblx0aWYgKHZlcmlmeVJlc3VsdCkge1xyXG5cdFx0Zm9yIChpbmRleCA9IDA7IGluZGV4IDwgdmVyaWZ5UmVzdWx0Lmxlbmd0aDsgaW5kZXgrKykge1xyXG5cdFx0XHRpZiAodmVyaWZ5UmVzdWx0W2luZGV4XS52YWxpZCkge1xyXG5cdFx0XHRcdHJlc3VsdCA9IHRydWU7XHJcblx0XHRcdFx0aWQgPSBcIjB4XCIgKyBvcGVucGdwLnV0aWwuaGV4c3RyZHVtcCh2ZXJpZnlSZXN1bHRbaW5kZXhdLmtleWlkLndyaXRlKCkpLnN1YnN0cmluZyg4KTtcclxuXHRcdFx0XHR1c2VyID0gbXNnSW5mby5rZXlMaXN0W2luZGV4XS5nZXRVc2VySWRzKClbMF07XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHRoaXMucmVzdWx0QmFyKG1zZ0luZm8sIHJlc3VsdCwgaWQsIHVzZXIpO1xyXG59O1xyXG5cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5yZW1vdmVGcm9tVGVtcENhY2hlID0gZnVuY3Rpb24gKG1zZ0lkKSB7XHJcblx0Ly8gSWYgd2UgaGF2ZSB0aGUgbmVjZXNzYXJ5IHNlc3Npb25TdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0c2Vzc2lvblN0b3JhZ2UucmVtb3ZlSXRlbShtc2dJZCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIEJ5IGRlZmF1bHQgY29va2llcyBhcmUgYWxsIHNlc3Npb25cclxuXHRcdGRvY3VtZW50LmNvb2tpZS5yZW1vdmVJdGVtKCdQR1BWZXJpZmllZF8nICsgbXNnSWQpO1xyXG5cdH1cclxufTtcclxuXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuc3RvcmVJblRlbXBDYWNoZSA9IGZ1bmN0aW9uIChtc2dJZCwgSFRNTCkge1xyXG5cdC8vIElmIHdlIGhhdmUgdGhlIG5lY2Vzc2FyeSBzZXNzaW9uU3RvcmFnZSBvYmplY3RcclxuXHRpZiAodGhpcy5oYXNMb2NhbFN0b3JhZ2UpIHtcclxuXHRcdHNlc3Npb25TdG9yYWdlLnNldEl0ZW0obXNnSWQsIGVzY2FwZShIVE1MKSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIEJ5IGRlZmF1bHQgY29va2llcyBhcmUgYWxsIHNlc3Npb25cclxuXHRcdGRvY3VtZW50LmNvb2tpZSA9ICdQR1BWZXJpZmllZF8nICsgbXNnSWQgKyc9JysgZXNjYXBlKEhUTUwpO1xyXG5cdH1cclxufTtcclxuXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuZ2V0RnJvbVRlbXBDYWNoZSA9IGZ1bmN0aW9uIChtc2dJZCkge1xyXG5cdC8vIElmIHdlIGhhdmUgdGhlIG5lY2Vzc2FyeSBsb2NhbFN0b3JhZ2Ugb2JqZWN0XHJcblx0aWYgKHRoaXMuaGFzTG9jYWxTdG9yYWdlKSB7XHJcblx0XHRtc2dIVE1MID0gc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbShtc2dJZCk7XHJcblx0XHRpZiAobXNnSFRNTCAhPT0gbnVsbCkge1xyXG5cdFx0XHRtc2dIVE1MID0gdW5lc2NhcGUobXNnSFRNTCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbXNnSFRNTDtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dmFyIGNvb2tpZXMgPSBkb2N1bWVudC5jb29raWUuc3BsaXQoJzsnKTtcclxuXHRcdHZhciBwZ3BDb29raWVzID0gW107XHJcblx0XHRmb3IgKGk9MDtpPGNvb2tpZXMubGVuZ3RoO2krKykge1xyXG5cdFx0XHQvLyBQb3B1bGF0ZSBvdXIgcGdwQ29va2llcyBhcnJheSB3aXRoIHRoZSBwb2ludGVycyB0byB0aGUgY29va2llcyB3ZSB3YW50XHJcblx0XHRcdGlmIChjb29raWVzW2ldLmluZGV4T2YoJ1BHUFZlcmlmaWVkXycpICE9IC0xKSB7XHJcblx0XHRcdFx0cGdwQ29va2llcy5wdXNoKGkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHQvLyBGb3IgZWFjaCBQR1AgY29va2llXHJcblx0XHRmb3IgKGk9MDtpPHBncENvb2tpZXMubGVuZ3RoO2krKykgeyAgICAgXHJcblx0XHRcdGlmIChjb29raWVzW3BncENvb2tpZXNbaV1dLnJlcGxhY2UoL15cXHMvLCcnKS5zcGxpdCgnPScpWzBdID09PSBcIlBHUFZlcmlmaWVkX1wiICsgbXNnSWQpIHtcclxuXHRcdFx0XHQvLyBEZWxpY2lvdXMgY29va2llc1xyXG5cdFx0XHRcdG1zZ0hUTUwgPSB1bmVzY2FwZShjb29raWVzW3BncENvb2tpZXNbaV1dLnJlcGxhY2UoL15cXHMvLCcnKS5zcGxpdCgnPScpWzFdKTtcclxuXHRcdFx0XHRyZXR1cm4gbXNnSFRNTDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fSAgICBcclxufTtcclxuXHJcbi8qXHJcbj09PT09IFRoZXNlIGNoYW5nZSB0aGUgaW5mb0JhciBzdHVmZiB0byBwYXNzL2ZhaWwgdmVyaWZpY2F0aW9uID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUudmVyaWZ5QmFyID0gZnVuY3Rpb24gKG1zZ0luZm8pIHtcclxuXHR2YXIgdmFsdWVzID0ge1xyXG5cdFx0bG9nbzogdGhpcy5nZXRSZXNvdXJjZSgncGdwLnBuZycpLFxyXG5cdFx0aW5mb0JhckRpdklkOiBtc2dJbmZvLmRpdklkXHJcblx0fTtcclxuXHR2YXIgemltbGV0ID0gdGhpcztcclxuXHR2YXIgZGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobXNnSW5mby5kaXZJZCk7XHJcblxyXG5cdGRpdi5pbm5lckhUTUwgPSBBanhUZW1wbGF0ZS5leHBhbmQoXCJvcmdfb3Blbl9zd19wZ3AudGVtcGxhdGVzLnBncCNpbmZvYmFyX3ZlcmlmeVwiLCB2YWx1ZXMpO1xyXG5cclxuXHRidXR0b25zID0gZGl2LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJ2ZXJpZnlCdXR0b25cIik7XHJcblx0YnV0dG9uc1swXS5vbmNsaWNrID0gZnVuY3Rpb24gKCkgeyB6aW1sZXQuc2VhcmNoRm9yS2V5KG1zZ0luZm8pOyB9O1xyXG5cclxuXHRidXR0b25zID0gZGl2LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJlc2NhcGVCdXR0b25cIik7XHJcblx0YnV0dG9uc1swXS5vbmNsaWNrID0gZnVuY3Rpb24gKCkgeyB6aW1sZXQuZGVzdHJveUluZm9CYXIobXNnSW5mbyk7IH07XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBUaGVzZSBjaGFuZ2UgdGhlIGluZm9CYXIgc3R1ZmYgdG8gcGFzcy9mYWlsIHZlcmlmaWNhdGlvbiA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnJlc3VsdEJhciA9IGZ1bmN0aW9uIChtc2dJbmZvLCBzdWNjZWVkZWQsIGtleUlkLCB1c2VyLCBtc2cpIHtcclxuXHR1c2VyID0gdXNlci5yZXBsYWNlKCc8JywnJmx0OycpLnJlcGxhY2UoJz4nLCcmZ3Q7Jyk7XHJcblxyXG5cdGlmICghbXNnKSB7XHJcblx0XHRtc2cgPSBzdWNjZWVkZWQgPyAndmVyaWZpZWQgc3VjY2Vzc2Z1bGx5IScgOiAnKk5PVCogdmVyaWZpZWQhJztcclxuXHR9XHJcblxyXG5cdHZhciB2YWx1ZXMgPSB7XHJcblx0XHRsb2dvOiB0aGlzLmdldFJlc291cmNlKCdwZ3AucG5nJyksXHJcblx0XHRjbGFzc05hbWU6IHN1Y2NlZWRlZCA/ICdzdWNjZXNzJyA6ICdmYWlsJyxcclxuXHRcdGlkOiBrZXlJZCxcclxuXHRcdHVzZXI6IHVzZXIsXHJcblx0XHRtc2c6IG1zZyxcclxuXHRcdGluZm9CYXJEaXZJZDogbXNnSW5mby5kaXZJZFxyXG5cdH07XHJcblx0dmFyIHppbWxldCA9IHRoaXM7XHJcblx0dmFyIGRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1zZ0luZm8uZGl2SWQpO1xyXG5cclxuXHRkaXYuaW5uZXJIVE1MID0gQWp4VGVtcGxhdGUuZXhwYW5kKFwib3JnX29wZW5fc3dfcGdwLnRlbXBsYXRlcy5wZ3AjaW5mb2Jhcl9yZXN1bHRcIiwgdmFsdWVzKTtcclxuXHJcblx0YnV0dG9ucyA9IGRpdi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXNjYXBlQnV0dG9uXCIpO1xyXG5cdGJ1dHRvbnNbMF0ub25jbGljayA9IGZ1bmN0aW9uICgpIHsgemltbGV0LmRlc3Ryb3lJbmZvQmFyKG1zZ0luZm8pOyB9O1xyXG59O1xyXG5cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fZGlhbG9nQ2xvc2VMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudG9iaikge1xyXG5cdGlmIChldmVudG9iaikge1xyXG5cdFx0ZXZlbnRvYmouaXRlbS5wYXJlbnQucG9wZG93bigpO1xyXG5cdH1cclxufTtcclxuIl19
(1)
});
;