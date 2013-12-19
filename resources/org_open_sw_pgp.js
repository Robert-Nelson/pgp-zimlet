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
org_open_sw_pgp.prototype = new ZmZimletBase;
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
	this.hasLocalStorage = typeof(window['localStorage']) == "object";

	//openpgp.config.debug = true;
};

/*
===== Draws our initial info bar with the proper signature algorithm =====
*/
org_open_sw_pgp.prototype.onConvView = function (msg, oldMsg, view) {
	this.processMsg(msg, view);
}

/*
===== Draws our initial info bar with the proper signature algorithm =====
*/
org_open_sw_pgp.prototype.onMsgView = function (msg, oldMsg, view) {
	this.processMsg(msg, view);
}

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

				bodyDiv.parentElement.insertBefore(div, bodyDiv);

				div = document.getElementById(div.id);
			}

			var msgInfo = { divId:div.id, mailMsgId: msgId };
			var zimlet = this;
			var html;
			var buttons;

			// Parse out our signature stuff and message text
			msgInfo.cleartext = openpgp.cleartext.readArmored(msgText);

			if (msgInfo.cleartext) {
				var values = {
					logo: this.getResource('pgp.png'),
					infoBarDivId: div.id
				};

				div.innerHTML = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_verify", values);

				buttons = div.getElementsByClassName("verifyButton");
				buttons[0].onclick = function () { zimlet.searchForKey(msgInfo); };
			} else {
				var values = {
					logo: this.getResource('pgp.png'),
					className: 'fail',
					id: 'unknown',
					user: 'unknown',
					msg: 'Error parsing message',
					infoBarDivId: div.id
				};

				div.innerHTML = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_result", values);
			}

			buttons = div.getElementsByClassName("escapeButton");
			buttons[0].onclick = function () { zimlet.destroyInfoBar(msgInfo); };

			if (this.testMode) {
				this.searchForKey(msgInfo);
			}

		}
	} else {
		//msg: 'Couldn\'t find message??',
		//debugger;
	}
}

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
===== This searches the interwebs for a suitable public key =====
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

	var HTML = '<div id="keyEntryDiv">' +
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
	if (msgInfo.keyList.length == 0) {
		var keyIdList = msgInfo.cleartext.getSigningKeyIds();
		for (var i = 0; i < keyIdList.length; i++) {
			var publicKeyList = this.keyring.getKeysForKeyId(openpgp.util.hexstrdump(keyIdList[i].write()));
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
		for (var i = 0; i < verifyResult.length; i++) {
			if (verifyResult[i].valid) {
				result = true;
				id = "0x" + openpgp.util.hexstrdump(verifyResult[i].keyid.write()).substring(8);
				user = msgInfo.keyList[i].getUserIds()[0];
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
		var pgpCookies = new Array();       
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
org_open_sw_pgp.prototype.resultBar = function (msgInfo, succeeded, keyId, user) {
	user = user.replace('<','&lt;').replace('>','&gt;');

	var values = {
		logo: this.getResource('pgp.png'),
		className: succeeded ? 'success' : 'fail',
		id: keyId,
		user: user,
		msg: succeeded ? 'verified successfully!' : '*NOT* verified!',
		infoBarDivId: msgInfo.divId
	};

	var html = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_result", values);
	var zimlet = this;
	var div = document.getElementById(msgInfo.divId);

	div.innerHTML = html;

	buttons = div.getElementsByClassName("escapeButton");
	buttons[0].onclick = function () { zimlet.destroyInfoBar(msgInfo); };
};

org_open_sw_pgp.prototype._dialogCloseListener = function (eventobj) {
	if (eventobj) {
		eventobj.item.parent.popdown();
	}
};

},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9yb2JlcnQvemltYnJhLXBncC9wZ3AtemltbGV0L3ppbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIvL1widXNlIHN0cmljdFwiO1xyXG5cclxuLypcclxuXHJcblRoaXMgZmlsZSBpcyByZXNwb25zaWJsZSBmb3IgYWxsIHRoZSBaaW1icmEgaW50ZWdyYXRpb24gZnVuY3Rpb25zIGFuZCBldmVyeXRoaW5nXHJcbmVsc2UgdGhhdCdzIGRvbmUgaW4gdGhlIHppbWJyYSBpbnRlcmZhY2VcclxuXHJcblRPRE86XHJcblx0ID0+IEJ1dHRvbiB0aGF0IGxpbmtzIHRvIG15IEdpdGh1YlxyXG5cdCA9PiBJbXBsZW1lbnQgb3B0aW9ucyB2aWEgc2V0VXNlclByb3BlcnR5KCkgYW5kIGdldFVzZXJQcm9wZXJ0eSgpXHJcblxyXG4vLyBMaXN0IGFsbCBwcm9wZXJ0aWVzIGluIG9iamVjdFxyXG5wcm9wZXJ0aWVzID0gYXBwQ3R4dC5femltbGV0TWdyLl9aSU1MRVRTX0JZX0lEWydvcmdfb3Blbl9zd19wZ3AnXS5fcHJvcHNCeUlkXHJcbmZvcih2YXIgaSBpbiBwcm9wZXJ0aWVzKSB7XHJcblx0aWYgKHByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcclxuXHRcdGNvbnNvbGUubG9nKGkgKyBcIiA9IFwiICsgcHJvcGVydGllc1tpXS52YWx1ZSk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuKi9cclxuXHJcbnZhciBvcGVucGdwID0gcmVxdWlyZSgnb3BlbnBncCcpO1xyXG5cclxuLypcclxuPT09PT0gRGVjbGFyZSBhIGJsYW5rIGNvbnN0cnVjdG9yLCBzaW5jZSB3ZSBkb24ndCBuZWVkIG9uZSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AgPSBmdW5jdGlvbiAodGVzdE1vZGUsIGtleXJpbmcpIHtcclxuXHR0aGlzLnRlc3RNb2RlID0gdGVzdE1vZGUgPyB0cnVlIDogZmFsc2U7XHJcblx0dGhpcy5rZXlyaW5nID0ga2V5cmluZyA/IGtleXJpbmcgOiByZXF1aXJlKCdrZXlyaW5nJyk7XHJcblx0b3BlbnBncC51dGlsLnByaW50X291dHB1dCA9IGZ1bmN0aW9uIChsZXZlbCwgc3RyKSB7XHJcblx0XHRpZiAoIXRoaXMudGVzdE1vZGUpIHtcclxuXHRcdFx0dmFyIGhlYWRlciA9IFwiVU5LTk9XTlwiO1xyXG5cdFx0XHRzd2l0Y2ggKGxldmVsKSB7XHJcblx0XHRcdFx0Y2FzZSBvcGVucGdwLnV0aWwucHJpbnRMZXZlbC5lcnJvcjpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiRVJST1JcIjtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2Ugb3BlbnBncC51dGlsLnByaW50TGV2ZWwud2FybmluZzpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiV0FSTklOR1wiO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBvcGVucGdwLnV0aWwucHJpbnRMZXZlbC5pbmZvOlxyXG5cdFx0XHRcdFx0aGVhZGVyID0gXCJJTkZPXCI7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlIG9wZW5wZ3AudXRpbC5wcmludExldmVsLmRlYnVnOlxyXG5cdFx0XHRcdFx0aGVhZGVyID0gXCJERUJVR1wiO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhoZWFkZXIgKyAnOiAnICsgc3RyKTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxufTtcclxuXHJcbi8qXHJcbj09PT09IEJ1aWxkIG91ciBwcm90b3R5cGUgZnJvbSBvdXIgY29uc3RydWN0b3IgYW5kIG9iamVjdEhhbmRsZXIgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZSA9IG5ldyBabVppbWxldEJhc2U7XHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBvcmdfb3Blbl9zd19wZ3A7XHJcblxyXG4vKlxyXG49PT09PSBTdHVwaWQgY29udmVudGlvbiwgYnV0IG1heSBiZSB1c2VkIGVsc2V3aGVyZSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xyXG5cdHJldHVybiBcIm9yZ19vcGVuX3N3X3BncFwiO1xyXG59O1xyXG5cclxuLypcclxuPT09PT0gSW5pdCBmdW5jdGlvbnMgKG5vdCBuZWVkZWQgcmVhbGx5KSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XHJcblx0dGhpcy5oYXNMb2NhbFN0b3JhZ2UgPSB0eXBlb2Yod2luZG93Wydsb2NhbFN0b3JhZ2UnXSkgPT0gXCJvYmplY3RcIjtcclxuXHJcblx0Ly9vcGVucGdwLmNvbmZpZy5kZWJ1ZyA9IHRydWU7XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBEcmF3cyBvdXIgaW5pdGlhbCBpbmZvIGJhciB3aXRoIHRoZSBwcm9wZXIgc2lnbmF0dXJlIGFsZ29yaXRobSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLm9uQ29udlZpZXcgPSBmdW5jdGlvbiAobXNnLCBvbGRNc2csIHZpZXcpIHtcclxuXHR0aGlzLnByb2Nlc3NNc2cobXNnLCB2aWV3KTtcclxufVxyXG5cclxuLypcclxuPT09PT0gRHJhd3Mgb3VyIGluaXRpYWwgaW5mbyBiYXIgd2l0aCB0aGUgcHJvcGVyIHNpZ25hdHVyZSBhbGdvcml0aG0gPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5vbk1zZ1ZpZXcgPSBmdW5jdGlvbiAobXNnLCBvbGRNc2csIHZpZXcpIHtcclxuXHR0aGlzLnByb2Nlc3NNc2cobXNnLCB2aWV3KTtcclxufVxyXG5cclxuLypcclxuPT09PT0gRHJhd3Mgb3VyIGluaXRpYWwgaW5mbyBiYXIgd2l0aCB0aGUgcHJvcGVyIHNpZ25hdHVyZSBhbGdvcml0aG0gPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5wcm9jZXNzTXNnID0gZnVuY3Rpb24gKG1zZywgdmlldykge1xyXG5cdHZhciBlbGVtSWQgPSB2aWV3Ll9odG1sRWxJZCArICdfX1BHUC1aaW1sZXQnO1xyXG5cclxuXHR2YXIgZGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZWxlbUlkKTtcclxuXHJcblx0aWYgKGRpdikge1xyXG5cdFx0dmFyIGh0bWwgPSB0aGlzLmdldEZyb21UZW1wQ2FjaGUobXNnLmlkKTtcclxuXHJcblx0XHRpZiAoaHRtbCkge1xyXG5cdFx0XHQvLyBNYWtlIHRoZSBiYXIgdmlzaWJsZVxyXG5cdFx0XHRkaXYuaW5uZXJIVE1MID0gaHRtbDtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gR2V0IHRoZSBwbGFpbiB0ZXh0IGJvZHlcclxuXHRtc2cuZ2V0Qm9keVBhcnQoWm1NaW1lVGFibGUuVEVYVF9QTEFJTiwgQWp4Q2FsbGJhY2suc2ltcGxlQ2xvc3VyZSh0aGlzLnByb2Nlc3NNc2dDQiwgdGhpcywgdmlldywgZGl2LCBtc2cuaWQpKTtcclxufTtcclxuXHJcbi8qXHJcbj09PT09IERyYXdzIG91ciBpbml0aWFsIGluZm8gYmFyIHdpdGggdGhlIHByb3BlciBzaWduYXR1cmUgYWxnb3JpdGhtID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUucHJvY2Vzc01zZ0NCID0gZnVuY3Rpb24gKHZpZXcsIGRpdiwgbXNnSWQsIGJvZHlQYXJ0KSB7XHJcblx0aWYgKGJvZHlQYXJ0KSB7XHJcblx0XHR2YXIgbXNnVGV4dCA9IGJvZHlQYXJ0LmdldENvbnRlbnQoKTtcclxuXHJcblx0XHRpZiAobXNnVGV4dC5tYXRjaCgvXi0tLS0tQkVHSU4gKC4qKS0tLS0tJC9tKSkge1xyXG5cdFx0XHRpZiAoIWRpdikge1xyXG5cdFx0XHRcdHZhciBib2R5RGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodmlldy5fbXNnQm9keURpdklkKTtcclxuXHJcblx0XHRcdFx0ZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdFx0XHRkaXYuaWQgPSB2aWV3Ll9odG1sRWxJZCArICdfX1BHUC1aaW1sZXQnO1xyXG5cclxuXHRcdFx0XHRib2R5RGl2LnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGRpdiwgYm9keURpdik7XHJcblxyXG5cdFx0XHRcdGRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGRpdi5pZCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBtc2dJbmZvID0geyBkaXZJZDpkaXYuaWQsIG1haWxNc2dJZDogbXNnSWQgfTtcclxuXHRcdFx0dmFyIHppbWxldCA9IHRoaXM7XHJcblx0XHRcdHZhciBodG1sO1xyXG5cdFx0XHR2YXIgYnV0dG9ucztcclxuXHJcblx0XHRcdC8vIFBhcnNlIG91dCBvdXIgc2lnbmF0dXJlIHN0dWZmIGFuZCBtZXNzYWdlIHRleHRcclxuXHRcdFx0bXNnSW5mby5jbGVhcnRleHQgPSBvcGVucGdwLmNsZWFydGV4dC5yZWFkQXJtb3JlZChtc2dUZXh0KTtcclxuXHJcblx0XHRcdGlmIChtc2dJbmZvLmNsZWFydGV4dCkge1xyXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSB7XHJcblx0XHRcdFx0XHRsb2dvOiB0aGlzLmdldFJlc291cmNlKCdwZ3AucG5nJyksXHJcblx0XHRcdFx0XHRpbmZvQmFyRGl2SWQ6IGRpdi5pZFxyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdGRpdi5pbm5lckhUTUwgPSBBanhUZW1wbGF0ZS5leHBhbmQoXCJvcmdfb3Blbl9zd19wZ3AudGVtcGxhdGVzLnBncCNpbmZvYmFyX3ZlcmlmeVwiLCB2YWx1ZXMpO1xyXG5cclxuXHRcdFx0XHRidXR0b25zID0gZGl2LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJ2ZXJpZnlCdXR0b25cIik7XHJcblx0XHRcdFx0YnV0dG9uc1swXS5vbmNsaWNrID0gZnVuY3Rpb24gKCkgeyB6aW1sZXQuc2VhcmNoRm9yS2V5KG1zZ0luZm8pOyB9O1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZhciB2YWx1ZXMgPSB7XHJcblx0XHRcdFx0XHRsb2dvOiB0aGlzLmdldFJlc291cmNlKCdwZ3AucG5nJyksXHJcblx0XHRcdFx0XHRjbGFzc05hbWU6ICdmYWlsJyxcclxuXHRcdFx0XHRcdGlkOiAndW5rbm93bicsXHJcblx0XHRcdFx0XHR1c2VyOiAndW5rbm93bicsXHJcblx0XHRcdFx0XHRtc2c6ICdFcnJvciBwYXJzaW5nIG1lc3NhZ2UnLFxyXG5cdFx0XHRcdFx0aW5mb0JhckRpdklkOiBkaXYuaWRcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRkaXYuaW5uZXJIVE1MID0gQWp4VGVtcGxhdGUuZXhwYW5kKFwib3JnX29wZW5fc3dfcGdwLnRlbXBsYXRlcy5wZ3AjaW5mb2Jhcl9yZXN1bHRcIiwgdmFsdWVzKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YnV0dG9ucyA9IGRpdi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXNjYXBlQnV0dG9uXCIpO1xyXG5cdFx0XHRidXR0b25zWzBdLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7IHppbWxldC5kZXN0cm95SW5mb0Jhcihtc2dJbmZvKTsgfTtcclxuXHJcblx0XHRcdGlmICh0aGlzLnRlc3RNb2RlKSB7XHJcblx0XHRcdFx0dGhpcy5zZWFyY2hGb3JLZXkobXNnSW5mbyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vbXNnOiAnQ291bGRuXFwndCBmaW5kIG1lc3NhZ2U/PycsXHJcblx0XHQvL2RlYnVnZ2VyO1xyXG5cdH1cclxufVxyXG5cclxuLypcclxuPT09PT0gRGVzdHJveXMgdGhlIGluZm8gYmFyID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuZGVzdHJveUluZm9CYXIgPSBmdW5jdGlvbiAobXNnSW5mbykge1xyXG5cdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1zZ0luZm8uZGl2SWQpLmlubmVySFRNTCA9IFwiXCI7XHJcblx0dGhpcy5yZW1vdmVGcm9tVGVtcENhY2hlKG1zZ0luZm8ubWFpbE1zZ0lkKTtcclxufTtcclxuXHJcblxyXG4vKlxyXG49PT09PSBTZWFyY2hlcyBjYWNoZSBmb3Iga2V5LCBpZiBub3QgZm91bmQsIGFzayBhYm91dCBnb2luZyBvbmxpbmUgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5zZWFyY2hGb3JLZXkgPSBmdW5jdGlvbiAobXNnSW5mbykge1xyXG5cdG1zZ0luZm8ua2V5TGlzdCA9IFtdO1xyXG5cdG1zZ0luZm8ua2V5SWRMaXN0ID0gW107XHJcblx0dmFyIGtleUlkTGlzdCA9IG1zZ0luZm8uY2xlYXJ0ZXh0LmdldFNpZ25pbmdLZXlJZHMoKTtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGtleUlkTGlzdC5sZW5ndGg7IGkrKykge1xyXG5cdFx0dmFyIGtleUlkID0gb3BlbnBncC51dGlsLmhleHN0cmR1bXAoa2V5SWRMaXN0W2ldLndyaXRlKCkpO1xyXG5cdFx0dmFyIHB1YmxpY0tleUxpc3QgPSB0aGlzLmtleXJpbmcuZ2V0S2V5c0ZvcktleUlkKGtleUlkKTtcclxuXHRcdGlmIChwdWJsaWNLZXlMaXN0ICYmIHB1YmxpY0tleUxpc3QubGVuZ3RoID4gMCkge1xyXG5cdFx0XHRtc2dJbmZvLmtleUxpc3QgPSBtc2dJbmZvLmtleUxpc3QuY29uY2F0KHB1YmxpY0tleUxpc3QpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bXNnSW5mby5rZXlJZExpc3QucHVzaChrZXlJZCk7XHJcblx0XHR9XHJcblx0fVxyXG5cdGlmIChtc2dJbmZvLmtleUxpc3QubGVuZ3RoID4gMCkge1xyXG5cdFx0Ly8gSWYgdGhpcyBrZXkgaXMgZm91bmQgaW4gdGhlIGNhY2hlXHJcblx0XHR0aGlzLm1zZ1ZlcmlmeShtc2dJbmZvKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0aWYgKCF0aGlzLnRlc3RNb2RlKSB7XHJcblx0XHRcdC8vIE90aGVyd2lzZSwgYXNrIGFib3V0IGdvaW5nIG9ubGluZVxyXG5cdFx0XHR2YXIgZGlhbG9nID0gYXBwQ3R4dC5nZXRZZXNOb01zZ0RpYWxvZygpOyBcclxuXHRcdFx0dmFyIGVyck1zZyA9IFwiQ291bGQgbm90IGZpbmQgcHVibGljIGtleSBpbiB0aGUgY2FjaGUsIHNlYXJjaCBwZ3AubWl0LmVkdSBmb3IgaXQ/XCI7XHJcblx0XHRcdHZhciBzdHlsZSA9IER3dE1lc3NhZ2VEaWFsb2cuSU5GT19TVFlMRTtcclxuXHJcblx0XHRcdGRpYWxvZy5zZXRCdXR0b25MaXN0ZW5lcihEd3REaWFsb2cuWUVTX0JVVFRPTiwgbmV3IEFqeExpc3RlbmVyKHRoaXMsIHRoaXMuX3NlYXJjaEJ0bkxpc3RlbmVyLCBtc2dJbmZvKSk7XHJcblx0XHRcdGRpYWxvZy5zZXRCdXR0b25MaXN0ZW5lcihEd3REaWFsb2cuTk9fQlVUVE9OLCBuZXcgQWp4TGlzdGVuZXIodGhpcywgdGhpcy5fZGlhbG9nQ2xvc2VMaXN0ZW5lcikpO1xyXG5cclxuXHRcdFx0ZGlhbG9nLnJlc2V0KCk7XHJcblx0XHRcdGRpYWxvZy5zZXRNZXNzYWdlKGVyck1zZywgc3R5bGUpO1xyXG5cdFx0XHRkaWFsb2cucG9wdXAoKTtcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBUaGlzIHNlYXJjaGVzIHRoZSBpbnRlcndlYnMgZm9yIGEgc3VpdGFibGUgcHVibGljIGtleSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9zZWFyY2hCdG5MaXN0ZW5lciA9IGZ1bmN0aW9uIChtc2dJbmZvLCBldmVudG9iaikge1xyXG5cdGlmIChldmVudG9iaikge1xyXG5cdFx0ZXZlbnRvYmouaXRlbS5wYXJlbnQucG9wZG93bigpO1xyXG5cdH1cclxuXHJcblx0dmFyIGtleWlkID0gbXNnSW5mby5rZXlJZExpc3RbMF07XHJcblx0dmFyIHJlc3BvbnNlID0gQWp4UnBjLmludm9rZShudWxsLCAnL3NlcnZpY2UvemltbGV0L29yZ19vcGVuX3N3X3BncC9sb29rdXAuanNwP2tleT0weCcra2V5aWQsIG51bGwsIG51bGwsIHRydWUpO1xyXG5cdC8vIElmIHdlIGRvbid0IGhhdmUgYSBudWxsIHJlc3BvbnNlXHJcblx0aWYgKHJlc3BvbnNlLnRleHQgIT09IFwiXCIgJiYgcmVzcG9uc2UudHh0ICE9PSBcIk5vIGVtYWlsIHNwZWNpZmllZFwiKSB7XHJcblx0XHQvLyBJZiB0aGUga2V5IHdhcyBmb3VuZCwgXHJcblx0XHQvLyBDcmVhdGUgYSBuZXcgdGVtcG9yYXJ5IGRpdiB0byBwb3B1bGF0ZSB3aXRoIG91ciByZXNwb25zZSBzbyB3ZSBjYW4gbmF2aWdhdGUgaXQgZWFzaWVyLCBhbmQgaGlkZSBpdC5cclxuXHRcdHZhciB0ZW1wX2RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdFx0dGVtcF9kaXYuaW5uZXJIVE1MID0gcmVzcG9uc2UudGV4dDtcclxuXHRcdHZhciBrZXl0ZXh0ID0gdGVtcF9kaXYuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3ByZScpWzBdLmlubmVySFRNTDtcclxuXHRcdHRoaXMua2V5cmluZy5pbXBvcnRLZXkoa2V5dGV4dCk7XHJcblx0XHR0aGlzLm1zZ1ZlcmlmeShtc2dJbmZvKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly8gSWYgbm8ga2V5IHdhcyBmb3VuZCwgZXJyb3Igb3V0IGFuZCBkaXNwbGF5IHRoZSBwcm9ibGVtLiBcclxuXHRcdC8vIFdpbGwgdXBkYXRlIHNvIG1hbnVhbCBrZXkgZW50cnkgaXMgcG9zc2libGUgbGF0ZXIuIFxyXG5cdFx0dmFyIGRpYWxvZyA9IGFwcEN0eHQuZ2V0WWVzTm9Nc2dEaWFsb2coKTsgXHJcblx0XHR2YXIgZXJyTXNnID0gXCJDb3VsZCBub3QgZmluZCB0aGUga2V5IG9uIHBncC5taXQuZWR1LCBlbnRlciBpdCBtYW51YWxseT9cIjtcclxuXHRcdHZhciBzdHlsZSA9IER3dE1lc3NhZ2VEaWFsb2cuSU5GT19TVFlMRTtcclxuXHJcblx0XHRkaWFsb2cuc2V0QnV0dG9uTGlzdGVuZXIoRHd0RGlhbG9nLllFU19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCBtYW51YWxLZXlFbnRyeSwgbXNnSW5mbykpO1xyXG5cdFx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5OT19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCBfZGlhbG9nQ2xvc2VMaXN0ZW5lcikpO1xyXG5cclxuXHRcdGRpYWxvZy5yZXNldCgpO1xyXG5cdFx0ZGlhbG9nLnNldE1lc3NhZ2UoZXJyTXNnLCBzdHlsZSk7XHJcblx0XHRkaWFsb2cucG9wdXAoKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBUaGlzIGlzIHRoZSBmdW5jdGlvbiByZXNwb25zaWJsZSBmb3IgdGhlIGRyYXdpbmcgb2YgdGhlIG1hbnVhbCBrZXkgZW50cnkgc3R1ZmYgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5tYW51YWxLZXlFbnRyeSA9IGZ1bmN0aW9uIChtc2dJbmZvLCBldmVudG9iaikge1xyXG5cdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHJcblx0dmFyIEhUTUwgPSAnPGRpdiBpZD1cImtleUVudHJ5RGl2XCI+JyArXHJcblx0XHRcdFx0ICAgJzx0ZXh0YXJlYSBpZD1cImtleUVudHJ5VGV4dGFyZWFcIj48L3RleHRhcmVhPicgK1xyXG5cdFx0XHQgICAnPC9kaXY+JztcclxuXHJcblx0dmFyIHNEaWFsb2dUaXRsZSA9IFwiPGNlbnRlcj5FbnRlciBpbiB0aGUgcHVibGljIGtleSBhbmQgcHJlc3MgXFxcIk9LXFxcIjwvY2VudGVyPlwiO1xyXG5cclxuXHR2YXIgdmlldyA9IG5ldyBEd3RDb21wb3NpdGUoYXBwQ3R4dC5nZXRTaGVsbCgpKTtcclxuXHR2aWV3LnNldFNpemUoXCI1MDBcIiwgXCI1MDBcIik7IFxyXG5cdHZpZXcuZ2V0SHRtbEVsZW1lbnQoKS5zdHlsZS5vdmVyZmxvdyA9IFwiYXV0b1wiO1xyXG5cdHZpZXcuZ2V0SHRtbEVsZW1lbnQoKS5pbm5lckhUTUwgPSBIVE1MO1xyXG5cclxuXHQvLyBwYXNzIHRoZSB0aXRsZSwgdmlldyAmIGJ1dHRvbnMgaW5mb3JtYXRpb24gdG8gY3JlYXRlIGRpYWxvZyBib3hcclxuXHR2YXIgZGlhbG9nID0gbmV3IFptRGlhbG9nKHt0aXRsZTpzRGlhbG9nVGl0bGUsIHZpZXc6dmlldywgcGFyZW50OmFwcEN0eHQuZ2V0U2hlbGwoKSwgc3RhbmRhcmRCdXR0b25zOltEd3REaWFsb2cuT0tfQlVUVE9OXX0pO1xyXG5cdGRpYWxvZy5zZXRCdXR0b25MaXN0ZW5lcihEd3REaWFsb2cuT0tfQlVUVE9OLCBuZXcgQWp4TGlzdGVuZXIodGhpcywgdGhpcy5fcmVhZEtleUxpc3RlbmVyLCBtc2dJbmZvKSk7XHJcblx0ZGlhbG9nLnBvcHVwKCk7XHJcbn07XHJcblxyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLl9yZWFkS2V5TGlzdGVuZXIgPSBmdW5jdGlvbiAobXNnSW5mbywgZXZlbnRvYmopIHtcclxuXHRldmVudG9iai5pdGVtLnBhcmVudC5wb3Bkb3duKCk7XHJcblxyXG5cdC8vIEdldCBvdXIga2V5IHBhc3RlZCBpbiwgYW5kIGNsZWFyIG91ciB0aGUgZW50cnkgaW4gdGhlIERPTVxyXG5cdHZhciBwZ3BLZXkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgna2V5RW50cnlUZXh0YXJlYScpLnZhbHVlO1xyXG5cdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdrZXlFbnRyeVRleHRhcmVhJykudmFsdWUgPSBcIlwiO1xyXG5cdHRoaXMua2V5cmluZy5pbXBvcnRLZXkocGdwS2V5KTtcclxuXHR0aGlzLm1zZ1ZlcmlmeShtc2dJbmZvKTtcclxufTtcclxuXHJcbi8qXHJcbj09PT09IFRoaXMgaXMgdGhlIGZ1bmN0aW9uIHJlc3BvbnNpYmxlIGZvciB2ZXJpZnlpbmcgdGhlIG1lc3NhZ2UgaXRzZWxmIGFuZCBjYWxsaW5nIHRoZSBwcm9wZXIgYmFyID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUubXNnVmVyaWZ5ID0gZnVuY3Rpb24gKG1zZ0luZm8pIHtcclxuXHRpZiAobXNnSW5mby5rZXlMaXN0Lmxlbmd0aCA9PSAwKSB7XHJcblx0XHR2YXIga2V5SWRMaXN0ID0gbXNnSW5mby5jbGVhcnRleHQuZ2V0U2lnbmluZ0tleUlkcygpO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBrZXlJZExpc3QubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0dmFyIHB1YmxpY0tleUxpc3QgPSB0aGlzLmtleXJpbmcuZ2V0S2V5c0ZvcktleUlkKG9wZW5wZ3AudXRpbC5oZXhzdHJkdW1wKGtleUlkTGlzdFtpXS53cml0ZSgpKSk7XHJcblx0XHRcdGlmIChwdWJsaWNLZXlMaXN0ICE9PSBudWxsICYmIHB1YmxpY0tleUxpc3QubGVuZ3RoID4gMCkge1xyXG5cdFx0XHRcdG1zZ0luZm8ua2V5TGlzdCA9IG1zZ0luZm8ua2V5TGlzdC5jb25jYXQocHVibGljS2V5TGlzdCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciByZXN1bHQgPSBmYWxzZTtcclxuXHR2YXIgaWQgPSBcIjB4XCIgKyBvcGVucGdwLnV0aWwuaGV4c3RyZHVtcChtc2dJbmZvLmtleUxpc3RbMF0uZ2V0S2V5SWRzKClbMF0ud3JpdGUoKSkuc3Vic3RyaW5nKDgpO1xyXG5cdHZhciB1c2VyID0gbXNnSW5mby5rZXlMaXN0WzBdLmdldFVzZXJJZHMoKVswXTtcclxuXHJcblx0dmFyIHZlcmlmeVJlc3VsdCA9IG1zZ0luZm8uY2xlYXJ0ZXh0LnZlcmlmeShtc2dJbmZvLmtleUxpc3QpO1xyXG5cdGlmICh2ZXJpZnlSZXN1bHQpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdmVyaWZ5UmVzdWx0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGlmICh2ZXJpZnlSZXN1bHRbaV0udmFsaWQpIHtcclxuXHRcdFx0XHRyZXN1bHQgPSB0cnVlO1xyXG5cdFx0XHRcdGlkID0gXCIweFwiICsgb3BlbnBncC51dGlsLmhleHN0cmR1bXAodmVyaWZ5UmVzdWx0W2ldLmtleWlkLndyaXRlKCkpLnN1YnN0cmluZyg4KTtcclxuXHRcdFx0XHR1c2VyID0gbXNnSW5mby5rZXlMaXN0W2ldLmdldFVzZXJJZHMoKVswXTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dGhpcy5yZXN1bHRCYXIobXNnSW5mbywgcmVzdWx0LCBpZCwgdXNlcik7XHJcbn07XHJcblxyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnJlbW92ZUZyb21UZW1wQ2FjaGUgPSBmdW5jdGlvbiAobXNnSWQpIHtcclxuXHQvLyBJZiB3ZSBoYXZlIHRoZSBuZWNlc3Nhcnkgc2Vzc2lvblN0b3JhZ2Ugb2JqZWN0XHJcblx0aWYgKHRoaXMuaGFzTG9jYWxTdG9yYWdlKSB7XHJcblx0XHRzZXNzaW9uU3RvcmFnZS5yZW1vdmVJdGVtKG1zZ0lkKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly8gQnkgZGVmYXVsdCBjb29raWVzIGFyZSBhbGwgc2Vzc2lvblxyXG5cdFx0ZG9jdW1lbnQuY29va2llLnJlbW92ZUl0ZW0oJ1BHUFZlcmlmaWVkXycgKyBtc2dJZCk7XHJcblx0fVxyXG59O1xyXG5cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5zdG9yZUluVGVtcENhY2hlID0gZnVuY3Rpb24gKG1zZ0lkLCBIVE1MKSB7XHJcblx0Ly8gSWYgd2UgaGF2ZSB0aGUgbmVjZXNzYXJ5IHNlc3Npb25TdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0c2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbShtc2dJZCwgZXNjYXBlKEhUTUwpKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly8gQnkgZGVmYXVsdCBjb29raWVzIGFyZSBhbGwgc2Vzc2lvblxyXG5cdFx0ZG9jdW1lbnQuY29va2llID0gJ1BHUFZlcmlmaWVkXycgKyBtc2dJZCArJz0nKyBlc2NhcGUoSFRNTCk7XHJcblx0fVxyXG59O1xyXG5cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5nZXRGcm9tVGVtcENhY2hlID0gZnVuY3Rpb24gKG1zZ0lkKSB7XHJcblx0Ly8gSWYgd2UgaGF2ZSB0aGUgbmVjZXNzYXJ5IGxvY2FsU3RvcmFnZSBvYmplY3RcclxuXHRpZiAodGhpcy5oYXNMb2NhbFN0b3JhZ2UpIHtcclxuXHRcdG1zZ0hUTUwgPSBzZXNzaW9uU3RvcmFnZS5nZXRJdGVtKG1zZ0lkKTtcclxuXHRcdGlmIChtc2dIVE1MICE9PSBudWxsKSB7XHJcblx0XHRcdG1zZ0hUTUwgPSB1bmVzY2FwZShtc2dIVE1MKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBtc2dIVE1MO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR2YXIgY29va2llcyA9IGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnOycpOyAgICAgICAgXHJcblx0XHR2YXIgcGdwQ29va2llcyA9IG5ldyBBcnJheSgpOyAgICAgICBcclxuXHRcdGZvciAoaT0wO2k8Y29va2llcy5sZW5ndGg7aSsrKSB7IFxyXG5cdFx0XHQvLyBQb3B1bGF0ZSBvdXIgcGdwQ29va2llcyBhcnJheSB3aXRoIHRoZSBwb2ludGVycyB0byB0aGUgY29va2llcyB3ZSB3YW50XHJcblx0XHRcdGlmIChjb29raWVzW2ldLmluZGV4T2YoJ1BHUFZlcmlmaWVkXycpICE9IC0xKSB7XHJcblx0XHRcdFx0cGdwQ29va2llcy5wdXNoKGkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHQvLyBGb3IgZWFjaCBQR1AgY29va2llXHJcblx0XHRmb3IgKGk9MDtpPHBncENvb2tpZXMubGVuZ3RoO2krKykgeyAgICAgXHJcblx0XHRcdGlmIChjb29raWVzW3BncENvb2tpZXNbaV1dLnJlcGxhY2UoL15cXHMvLCcnKS5zcGxpdCgnPScpWzBdID09PSBcIlBHUFZlcmlmaWVkX1wiICsgbXNnSWQpIHtcclxuXHRcdFx0XHQvLyBEZWxpY2lvdXMgY29va2llc1xyXG5cdFx0XHRcdG1zZ0hUTUwgPSB1bmVzY2FwZShjb29raWVzW3BncENvb2tpZXNbaV1dLnJlcGxhY2UoL15cXHMvLCcnKS5zcGxpdCgnPScpWzFdKTtcclxuXHRcdFx0XHRyZXR1cm4gbXNnSFRNTDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fSAgICBcclxufTtcclxuXHJcbi8qXHJcbj09PT09IFRoZXNlIGNoYW5nZSB0aGUgaW5mb0JhciBzdHVmZiB0byBwYXNzL2ZhaWwgdmVyaWZpY2F0aW9uID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUucmVzdWx0QmFyID0gZnVuY3Rpb24gKG1zZ0luZm8sIHN1Y2NlZWRlZCwga2V5SWQsIHVzZXIpIHtcclxuXHR1c2VyID0gdXNlci5yZXBsYWNlKCc8JywnJmx0OycpLnJlcGxhY2UoJz4nLCcmZ3Q7Jyk7XHJcblxyXG5cdHZhciB2YWx1ZXMgPSB7XHJcblx0XHRsb2dvOiB0aGlzLmdldFJlc291cmNlKCdwZ3AucG5nJyksXHJcblx0XHRjbGFzc05hbWU6IHN1Y2NlZWRlZCA/ICdzdWNjZXNzJyA6ICdmYWlsJyxcclxuXHRcdGlkOiBrZXlJZCxcclxuXHRcdHVzZXI6IHVzZXIsXHJcblx0XHRtc2c6IHN1Y2NlZWRlZCA/ICd2ZXJpZmllZCBzdWNjZXNzZnVsbHkhJyA6ICcqTk9UKiB2ZXJpZmllZCEnLFxyXG5cdFx0aW5mb0JhckRpdklkOiBtc2dJbmZvLmRpdklkXHJcblx0fTtcclxuXHJcblx0dmFyIGh0bWwgPSBBanhUZW1wbGF0ZS5leHBhbmQoXCJvcmdfb3Blbl9zd19wZ3AudGVtcGxhdGVzLnBncCNpbmZvYmFyX3Jlc3VsdFwiLCB2YWx1ZXMpO1xyXG5cdHZhciB6aW1sZXQgPSB0aGlzO1xyXG5cdHZhciBkaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtc2dJbmZvLmRpdklkKTtcclxuXHJcblx0ZGl2LmlubmVySFRNTCA9IGh0bWw7XHJcblxyXG5cdGJ1dHRvbnMgPSBkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImVzY2FwZUJ1dHRvblwiKTtcclxuXHRidXR0b25zWzBdLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7IHppbWxldC5kZXN0cm95SW5mb0Jhcihtc2dJbmZvKTsgfTtcclxufTtcclxuXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX2RpYWxvZ0Nsb3NlTGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnRvYmopIHtcclxuXHRpZiAoZXZlbnRvYmopIHtcclxuXHRcdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHR9XHJcbn07XHJcbiJdfQ==
(1)
});
;