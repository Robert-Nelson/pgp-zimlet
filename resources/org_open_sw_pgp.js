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
				div.className = 'pgpInfoBar';

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
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvaG9tZS9yb2JlcnQvemltYnJhLXBncC9wZ3AtemltbGV0L3BncC16aW1sZXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIvL1widXNlIHN0cmljdFwiO1xyXG5cclxuLypcclxuXHJcblRoaXMgZmlsZSBpcyByZXNwb25zaWJsZSBmb3IgYWxsIHRoZSBaaW1icmEgaW50ZWdyYXRpb24gZnVuY3Rpb25zIGFuZCBldmVyeXRoaW5nXHJcbmVsc2UgdGhhdCdzIGRvbmUgaW4gdGhlIHppbWJyYSBpbnRlcmZhY2VcclxuXHJcblRPRE86XHJcblx0ID0+IEJ1dHRvbiB0aGF0IGxpbmtzIHRvIG15IEdpdGh1YlxyXG5cdCA9PiBJbXBsZW1lbnQgb3B0aW9ucyB2aWEgc2V0VXNlclByb3BlcnR5KCkgYW5kIGdldFVzZXJQcm9wZXJ0eSgpXHJcblxyXG4vLyBMaXN0IGFsbCBwcm9wZXJ0aWVzIGluIG9iamVjdFxyXG5wcm9wZXJ0aWVzID0gYXBwQ3R4dC5femltbGV0TWdyLl9aSU1MRVRTX0JZX0lEWydvcmdfb3Blbl9zd19wZ3AnXS5fcHJvcHNCeUlkXHJcbmZvcih2YXIgaSBpbiBwcm9wZXJ0aWVzKSB7XHJcblx0aWYgKHByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcclxuXHRcdGNvbnNvbGUubG9nKGkgKyBcIiA9IFwiICsgcHJvcGVydGllc1tpXS52YWx1ZSk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuKi9cclxuXHJcbnZhciBvcGVucGdwID0gcmVxdWlyZSgnb3BlbnBncCcpO1xyXG5cclxuLypcclxuPT09PT0gRGVjbGFyZSBhIGJsYW5rIGNvbnN0cnVjdG9yLCBzaW5jZSB3ZSBkb24ndCBuZWVkIG9uZSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AgPSBmdW5jdGlvbiAodGVzdE1vZGUsIGtleXJpbmcpIHtcclxuXHR0aGlzLnRlc3RNb2RlID0gdGVzdE1vZGUgPyB0cnVlIDogZmFsc2U7XHJcblx0dGhpcy5rZXlyaW5nID0ga2V5cmluZyA/IGtleXJpbmcgOiByZXF1aXJlKCdrZXlyaW5nJyk7XHJcblx0b3BlbnBncC51dGlsLnByaW50X291dHB1dCA9IGZ1bmN0aW9uIChsZXZlbCwgc3RyKSB7XHJcblx0XHRpZiAoIXRoaXMudGVzdE1vZGUpIHtcclxuXHRcdFx0dmFyIGhlYWRlciA9IFwiVU5LTk9XTlwiO1xyXG5cdFx0XHRzd2l0Y2ggKGxldmVsKSB7XHJcblx0XHRcdFx0Y2FzZSBvcGVucGdwLnV0aWwucHJpbnRMZXZlbC5lcnJvcjpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiRVJST1JcIjtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2Ugb3BlbnBncC51dGlsLnByaW50TGV2ZWwud2FybmluZzpcclxuXHRcdFx0XHRcdGhlYWRlciA9IFwiV0FSTklOR1wiO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBvcGVucGdwLnV0aWwucHJpbnRMZXZlbC5pbmZvOlxyXG5cdFx0XHRcdFx0aGVhZGVyID0gXCJJTkZPXCI7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlIG9wZW5wZ3AudXRpbC5wcmludExldmVsLmRlYnVnOlxyXG5cdFx0XHRcdFx0aGVhZGVyID0gXCJERUJVR1wiO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhoZWFkZXIgKyAnOiAnICsgc3RyKTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxufTtcclxuXHJcbi8qXHJcbj09PT09IEJ1aWxkIG91ciBwcm90b3R5cGUgZnJvbSBvdXIgY29uc3RydWN0b3IgYW5kIG9iamVjdEhhbmRsZXIgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZSA9IG5ldyBabVppbWxldEJhc2U7XHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBvcmdfb3Blbl9zd19wZ3A7XHJcblxyXG4vKlxyXG49PT09PSBTdHVwaWQgY29udmVudGlvbiwgYnV0IG1heSBiZSB1c2VkIGVsc2V3aGVyZSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xyXG5cdHJldHVybiBcIm9yZ19vcGVuX3N3X3BncFwiO1xyXG59O1xyXG5cclxuLypcclxuPT09PT0gSW5pdCBmdW5jdGlvbnMgKG5vdCBuZWVkZWQgcmVhbGx5KSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XHJcblx0dGhpcy5oYXNMb2NhbFN0b3JhZ2UgPSB0eXBlb2Yod2luZG93Wydsb2NhbFN0b3JhZ2UnXSkgPT0gXCJvYmplY3RcIjtcclxuXHJcblx0Ly9vcGVucGdwLmNvbmZpZy5kZWJ1ZyA9IHRydWU7XHJcbn07XHJcblxyXG4vKlxyXG49PT09PSBEcmF3cyBvdXIgaW5pdGlhbCBpbmZvIGJhciB3aXRoIHRoZSBwcm9wZXIgc2lnbmF0dXJlIGFsZ29yaXRobSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLm9uQ29udlZpZXcgPSBmdW5jdGlvbiAobXNnLCBvbGRNc2csIHZpZXcpIHtcclxuXHR0aGlzLnByb2Nlc3NNc2cobXNnLCB2aWV3KTtcclxufVxyXG5cclxuLypcclxuPT09PT0gRHJhd3Mgb3VyIGluaXRpYWwgaW5mbyBiYXIgd2l0aCB0aGUgcHJvcGVyIHNpZ25hdHVyZSBhbGdvcml0aG0gPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5vbk1zZ1ZpZXcgPSBmdW5jdGlvbiAobXNnLCBvbGRNc2csIHZpZXcpIHtcclxuXHR0aGlzLnByb2Nlc3NNc2cobXNnLCB2aWV3KTtcclxufVxyXG5cclxuLypcclxuPT09PT0gRHJhd3Mgb3VyIGluaXRpYWwgaW5mbyBiYXIgd2l0aCB0aGUgcHJvcGVyIHNpZ25hdHVyZSBhbGdvcml0aG0gPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5wcm9jZXNzTXNnID0gZnVuY3Rpb24gKG1zZywgdmlldykge1xyXG5cdHZhciBlbGVtSWQgPSB2aWV3Ll9odG1sRWxJZCArICdfX1BHUC1aaW1sZXQnO1xyXG5cclxuXHR2YXIgZGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZWxlbUlkKTtcclxuXHJcblx0aWYgKGRpdikge1xyXG5cdFx0dmFyIGh0bWwgPSB0aGlzLmdldEZyb21UZW1wQ2FjaGUobXNnLmlkKTtcclxuXHJcblx0XHRpZiAoaHRtbCkge1xyXG5cdFx0XHQvLyBNYWtlIHRoZSBiYXIgdmlzaWJsZVxyXG5cdFx0XHRkaXYuaW5uZXJIVE1MID0gaHRtbDtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gR2V0IHRoZSBwbGFpbiB0ZXh0IGJvZHlcclxuXHRtc2cuZ2V0Qm9keVBhcnQoWm1NaW1lVGFibGUuVEVYVF9QTEFJTiwgQWp4Q2FsbGJhY2suc2ltcGxlQ2xvc3VyZSh0aGlzLnByb2Nlc3NNc2dDQiwgdGhpcywgdmlldywgZGl2LCBtc2cuaWQpKTtcclxufTtcclxuXHJcbi8qXHJcbj09PT09IERyYXdzIG91ciBpbml0aWFsIGluZm8gYmFyIHdpdGggdGhlIHByb3BlciBzaWduYXR1cmUgYWxnb3JpdGhtID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUucHJvY2Vzc01zZ0NCID0gZnVuY3Rpb24gKHZpZXcsIGRpdiwgbXNnSWQsIGJvZHlQYXJ0KSB7XHJcblx0aWYgKGJvZHlQYXJ0KSB7XHJcblx0XHR2YXIgbXNnVGV4dCA9IGJvZHlQYXJ0LmdldENvbnRlbnQoKTtcclxuXHJcblx0XHRpZiAobXNnVGV4dC5tYXRjaCgvXi0tLS0tQkVHSU4gKC4qKS0tLS0tJC9tKSkge1xyXG5cdFx0XHRpZiAoIWRpdikge1xyXG5cdFx0XHRcdHZhciBib2R5RGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodmlldy5fbXNnQm9keURpdklkKTtcclxuXHJcblx0XHRcdFx0ZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdFx0XHRkaXYuaWQgPSB2aWV3Ll9odG1sRWxJZCArICdfX1BHUC1aaW1sZXQnO1xyXG5cdFx0XHRcdGRpdi5jbGFzc05hbWUgPSAncGdwSW5mb0Jhcic7XHJcblxyXG5cdFx0XHRcdGJvZHlEaXYucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoZGl2LCBib2R5RGl2KTtcclxuXHJcblx0XHRcdFx0ZGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZGl2LmlkKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIG1zZ0luZm8gPSB7IGRpdklkOmRpdi5pZCwgbWFpbE1zZ0lkOiBtc2dJZCB9O1xyXG5cdFx0XHR2YXIgemltbGV0ID0gdGhpcztcclxuXHRcdFx0dmFyIGh0bWw7XHJcblx0XHRcdHZhciBidXR0b25zO1xyXG5cclxuXHRcdFx0Ly8gUGFyc2Ugb3V0IG91ciBzaWduYXR1cmUgc3R1ZmYgYW5kIG1lc3NhZ2UgdGV4dFxyXG5cdFx0XHRtc2dJbmZvLmNsZWFydGV4dCA9IG9wZW5wZ3AuY2xlYXJ0ZXh0LnJlYWRBcm1vcmVkKG1zZ1RleHQpO1xyXG5cclxuXHRcdFx0aWYgKG1zZ0luZm8uY2xlYXJ0ZXh0KSB7XHJcblx0XHRcdFx0dmFyIHZhbHVlcyA9IHtcclxuXHRcdFx0XHRcdGxvZ286IHRoaXMuZ2V0UmVzb3VyY2UoJ3BncC5wbmcnKSxcclxuXHRcdFx0XHRcdGluZm9CYXJEaXZJZDogZGl2LmlkXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0ZGl2LmlubmVySFRNTCA9IEFqeFRlbXBsYXRlLmV4cGFuZChcIm9yZ19vcGVuX3N3X3BncC50ZW1wbGF0ZXMucGdwI2luZm9iYXJfdmVyaWZ5XCIsIHZhbHVlcyk7XHJcblxyXG5cdFx0XHRcdGJ1dHRvbnMgPSBkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcInZlcmlmeUJ1dHRvblwiKTtcclxuXHRcdFx0XHRidXR0b25zWzBdLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7IHppbWxldC5zZWFyY2hGb3JLZXkobXNnSW5mbyk7IH07XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIHZhbHVlcyA9IHtcclxuXHRcdFx0XHRcdGxvZ286IHRoaXMuZ2V0UmVzb3VyY2UoJ3BncC5wbmcnKSxcclxuXHRcdFx0XHRcdGNsYXNzTmFtZTogJ2ZhaWwnLFxyXG5cdFx0XHRcdFx0aWQ6ICd1bmtub3duJyxcclxuXHRcdFx0XHRcdHVzZXI6ICd1bmtub3duJyxcclxuXHRcdFx0XHRcdG1zZzogJ0Vycm9yIHBhcnNpbmcgbWVzc2FnZScsXHJcblx0XHRcdFx0XHRpbmZvQmFyRGl2SWQ6IGRpdi5pZFxyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdGRpdi5pbm5lckhUTUwgPSBBanhUZW1wbGF0ZS5leHBhbmQoXCJvcmdfb3Blbl9zd19wZ3AudGVtcGxhdGVzLnBncCNpbmZvYmFyX3Jlc3VsdFwiLCB2YWx1ZXMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRidXR0b25zID0gZGl2LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJlc2NhcGVCdXR0b25cIik7XHJcblx0XHRcdGJ1dHRvbnNbMF0ub25jbGljayA9IGZ1bmN0aW9uICgpIHsgemltbGV0LmRlc3Ryb3lJbmZvQmFyKG1zZ0luZm8pOyB9O1xyXG5cclxuXHRcdFx0aWYgKHRoaXMudGVzdE1vZGUpIHtcclxuXHRcdFx0XHR0aGlzLnNlYXJjaEZvcktleShtc2dJbmZvKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly9tc2c6ICdDb3VsZG5cXCd0IGZpbmQgbWVzc2FnZT8/JyxcclxuXHRcdC8vZGVidWdnZXI7XHJcblx0fVxyXG59XHJcblxyXG4vKlxyXG49PT09PSBEZXN0cm95cyB0aGUgaW5mbyBiYXIgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5kZXN0cm95SW5mb0JhciA9IGZ1bmN0aW9uIChtc2dJbmZvKSB7XHJcblx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobXNnSW5mby5kaXZJZCkuaW5uZXJIVE1MID0gXCJcIjtcclxuXHR0aGlzLnJlbW92ZUZyb21UZW1wQ2FjaGUobXNnSW5mby5tYWlsTXNnSWQpO1xyXG59O1xyXG5cclxuXHJcbi8qXHJcbj09PT09IFNlYXJjaGVzIGNhY2hlIGZvciBrZXksIGlmIG5vdCBmb3VuZCwgYXNrIGFib3V0IGdvaW5nIG9ubGluZSA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnNlYXJjaEZvcktleSA9IGZ1bmN0aW9uIChtc2dJbmZvKSB7XHJcblx0bXNnSW5mby5rZXlMaXN0ID0gW107XHJcblx0bXNnSW5mby5rZXlJZExpc3QgPSBbXTtcclxuXHR2YXIga2V5SWRMaXN0ID0gbXNnSW5mby5jbGVhcnRleHQuZ2V0U2lnbmluZ0tleUlkcygpO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwga2V5SWRMaXN0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHR2YXIga2V5SWQgPSBvcGVucGdwLnV0aWwuaGV4c3RyZHVtcChrZXlJZExpc3RbaV0ud3JpdGUoKSk7XHJcblx0XHR2YXIgcHVibGljS2V5TGlzdCA9IHRoaXMua2V5cmluZy5nZXRLZXlzRm9yS2V5SWQoa2V5SWQpO1xyXG5cdFx0aWYgKHB1YmxpY0tleUxpc3QgJiYgcHVibGljS2V5TGlzdC5sZW5ndGggPiAwKSB7XHJcblx0XHRcdG1zZ0luZm8ua2V5TGlzdCA9IG1zZ0luZm8ua2V5TGlzdC5jb25jYXQocHVibGljS2V5TGlzdCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtc2dJbmZvLmtleUlkTGlzdC5wdXNoKGtleUlkKTtcclxuXHRcdH1cclxuXHR9XHJcblx0aWYgKG1zZ0luZm8ua2V5TGlzdC5sZW5ndGggPiAwKSB7XHJcblx0XHQvLyBJZiB0aGlzIGtleSBpcyBmb3VuZCBpbiB0aGUgY2FjaGVcclxuXHRcdHRoaXMubXNnVmVyaWZ5KG1zZ0luZm8pO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRpZiAoIXRoaXMudGVzdE1vZGUpIHtcclxuXHRcdFx0Ly8gT3RoZXJ3aXNlLCBhc2sgYWJvdXQgZ29pbmcgb25saW5lXHJcblx0XHRcdHZhciBkaWFsb2cgPSBhcHBDdHh0LmdldFllc05vTXNnRGlhbG9nKCk7IFxyXG5cdFx0XHR2YXIgZXJyTXNnID0gXCJDb3VsZCBub3QgZmluZCBwdWJsaWMga2V5IGluIHRoZSBjYWNoZSwgc2VhcmNoIHBncC5taXQuZWR1IGZvciBpdD9cIjtcclxuXHRcdFx0dmFyIHN0eWxlID0gRHd0TWVzc2FnZURpYWxvZy5JTkZPX1NUWUxFO1xyXG5cclxuXHRcdFx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5ZRVNfQlVUVE9OLCBuZXcgQWp4TGlzdGVuZXIodGhpcywgdGhpcy5fc2VhcmNoQnRuTGlzdGVuZXIsIG1zZ0luZm8pKTtcclxuXHRcdFx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5OT19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCB0aGlzLl9kaWFsb2dDbG9zZUxpc3RlbmVyKSk7XHJcblxyXG5cdFx0XHRkaWFsb2cucmVzZXQoKTtcclxuXHRcdFx0ZGlhbG9nLnNldE1lc3NhZ2UoZXJyTXNnLCBzdHlsZSk7XHJcblx0XHRcdGRpYWxvZy5wb3B1cCgpO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qXHJcbj09PT09IFRoaXMgc2VhcmNoZXMgdGhlIGludGVyd2VicyBmb3IgYSBzdWl0YWJsZSBwdWJsaWMga2V5ID09PT09XHJcbiovXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX3NlYXJjaEJ0bkxpc3RlbmVyID0gZnVuY3Rpb24gKG1zZ0luZm8sIGV2ZW50b2JqKSB7XHJcblx0aWYgKGV2ZW50b2JqKSB7XHJcblx0XHRldmVudG9iai5pdGVtLnBhcmVudC5wb3Bkb3duKCk7XHJcblx0fVxyXG5cclxuXHR2YXIga2V5aWQgPSBtc2dJbmZvLmtleUlkTGlzdFswXTtcclxuXHR2YXIgcmVzcG9uc2UgPSBBanhScGMuaW52b2tlKG51bGwsICcvc2VydmljZS96aW1sZXQvb3JnX29wZW5fc3dfcGdwL2xvb2t1cC5qc3A/a2V5PTB4JytrZXlpZCwgbnVsbCwgbnVsbCwgdHJ1ZSk7XHJcblx0Ly8gSWYgd2UgZG9uJ3QgaGF2ZSBhIG51bGwgcmVzcG9uc2VcclxuXHRpZiAocmVzcG9uc2UudGV4dCAhPT0gXCJcIiAmJiByZXNwb25zZS50eHQgIT09IFwiTm8gZW1haWwgc3BlY2lmaWVkXCIpIHtcclxuXHRcdC8vIElmIHRoZSBrZXkgd2FzIGZvdW5kLCBcclxuXHRcdC8vIENyZWF0ZSBhIG5ldyB0ZW1wb3JhcnkgZGl2IHRvIHBvcHVsYXRlIHdpdGggb3VyIHJlc3BvbnNlIHNvIHdlIGNhbiBuYXZpZ2F0ZSBpdCBlYXNpZXIsIGFuZCBoaWRlIGl0LlxyXG5cdFx0dmFyIHRlbXBfZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcblx0XHR0ZW1wX2Rpdi5pbm5lckhUTUwgPSByZXNwb25zZS50ZXh0O1xyXG5cdFx0dmFyIGtleXRleHQgPSB0ZW1wX2Rpdi5nZXRFbGVtZW50c0J5VGFnTmFtZSgncHJlJylbMF0uaW5uZXJIVE1MO1xyXG5cdFx0dGhpcy5rZXlyaW5nLmltcG9ydEtleShrZXl0ZXh0KTtcclxuXHRcdHRoaXMubXNnVmVyaWZ5KG1zZ0luZm8pO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQvLyBJZiBubyBrZXkgd2FzIGZvdW5kLCBlcnJvciBvdXQgYW5kIGRpc3BsYXkgdGhlIHByb2JsZW0uIFxyXG5cdFx0Ly8gV2lsbCB1cGRhdGUgc28gbWFudWFsIGtleSBlbnRyeSBpcyBwb3NzaWJsZSBsYXRlci4gXHJcblx0XHR2YXIgZGlhbG9nID0gYXBwQ3R4dC5nZXRZZXNOb01zZ0RpYWxvZygpOyBcclxuXHRcdHZhciBlcnJNc2cgPSBcIkNvdWxkIG5vdCBmaW5kIHRoZSBrZXkgb24gcGdwLm1pdC5lZHUsIGVudGVyIGl0IG1hbnVhbGx5P1wiO1xyXG5cdFx0dmFyIHN0eWxlID0gRHd0TWVzc2FnZURpYWxvZy5JTkZPX1NUWUxFO1xyXG5cclxuXHRcdGRpYWxvZy5zZXRCdXR0b25MaXN0ZW5lcihEd3REaWFsb2cuWUVTX0JVVFRPTiwgbmV3IEFqeExpc3RlbmVyKHRoaXMsIG1hbnVhbEtleUVudHJ5LCBtc2dJbmZvKSk7XHJcblx0XHRkaWFsb2cuc2V0QnV0dG9uTGlzdGVuZXIoRHd0RGlhbG9nLk5PX0JVVFRPTiwgbmV3IEFqeExpc3RlbmVyKHRoaXMsIF9kaWFsb2dDbG9zZUxpc3RlbmVyKSk7XHJcblxyXG5cdFx0ZGlhbG9nLnJlc2V0KCk7XHJcblx0XHRkaWFsb2cuc2V0TWVzc2FnZShlcnJNc2csIHN0eWxlKTtcclxuXHRcdGRpYWxvZy5wb3B1cCgpO1xyXG5cdH1cclxufTtcclxuXHJcbi8qXHJcbj09PT09IFRoaXMgaXMgdGhlIGZ1bmN0aW9uIHJlc3BvbnNpYmxlIGZvciB0aGUgZHJhd2luZyBvZiB0aGUgbWFudWFsIGtleSBlbnRyeSBzdHVmZiA9PT09PVxyXG4qL1xyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLm1hbnVhbEtleUVudHJ5ID0gZnVuY3Rpb24gKG1zZ0luZm8sIGV2ZW50b2JqKSB7XHJcblx0ZXZlbnRvYmouaXRlbS5wYXJlbnQucG9wZG93bigpO1xyXG5cclxuXHR2YXIgSFRNTCA9ICc8ZGl2IGlkPVwia2V5RW50cnlEaXZcIj4nICtcclxuXHRcdFx0XHQgICAnPHRleHRhcmVhIGlkPVwia2V5RW50cnlUZXh0YXJlYVwiPjwvdGV4dGFyZWE+JyArXHJcblx0XHRcdCAgICc8L2Rpdj4nO1xyXG5cclxuXHR2YXIgc0RpYWxvZ1RpdGxlID0gXCI8Y2VudGVyPkVudGVyIGluIHRoZSBwdWJsaWMga2V5IGFuZCBwcmVzcyBcXFwiT0tcXFwiPC9jZW50ZXI+XCI7XHJcblxyXG5cdHZhciB2aWV3ID0gbmV3IER3dENvbXBvc2l0ZShhcHBDdHh0LmdldFNoZWxsKCkpO1xyXG5cdHZpZXcuc2V0U2l6ZShcIjUwMFwiLCBcIjUwMFwiKTsgXHJcblx0dmlldy5nZXRIdG1sRWxlbWVudCgpLnN0eWxlLm92ZXJmbG93ID0gXCJhdXRvXCI7XHJcblx0dmlldy5nZXRIdG1sRWxlbWVudCgpLmlubmVySFRNTCA9IEhUTUw7XHJcblxyXG5cdC8vIHBhc3MgdGhlIHRpdGxlLCB2aWV3ICYgYnV0dG9ucyBpbmZvcm1hdGlvbiB0byBjcmVhdGUgZGlhbG9nIGJveFxyXG5cdHZhciBkaWFsb2cgPSBuZXcgWm1EaWFsb2coe3RpdGxlOnNEaWFsb2dUaXRsZSwgdmlldzp2aWV3LCBwYXJlbnQ6YXBwQ3R4dC5nZXRTaGVsbCgpLCBzdGFuZGFyZEJ1dHRvbnM6W0R3dERpYWxvZy5PS19CVVRUT05dfSk7XHJcblx0ZGlhbG9nLnNldEJ1dHRvbkxpc3RlbmVyKER3dERpYWxvZy5PS19CVVRUT04sIG5ldyBBanhMaXN0ZW5lcih0aGlzLCB0aGlzLl9yZWFkS2V5TGlzdGVuZXIsIG1zZ0luZm8pKTtcclxuXHRkaWFsb2cucG9wdXAoKTtcclxufTtcclxuXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUuX3JlYWRLZXlMaXN0ZW5lciA9IGZ1bmN0aW9uIChtc2dJbmZvLCBldmVudG9iaikge1xyXG5cdGV2ZW50b2JqLml0ZW0ucGFyZW50LnBvcGRvd24oKTtcclxuXHJcblx0Ly8gR2V0IG91ciBrZXkgcGFzdGVkIGluLCBhbmQgY2xlYXIgb3VyIHRoZSBlbnRyeSBpbiB0aGUgRE9NXHJcblx0dmFyIHBncEtleSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdrZXlFbnRyeVRleHRhcmVhJykudmFsdWU7XHJcblx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2tleUVudHJ5VGV4dGFyZWEnKS52YWx1ZSA9IFwiXCI7XHJcblx0dGhpcy5rZXlyaW5nLmltcG9ydEtleShwZ3BLZXkpO1xyXG5cdHRoaXMubXNnVmVyaWZ5KG1zZ0luZm8pO1xyXG59O1xyXG5cclxuLypcclxuPT09PT0gVGhpcyBpcyB0aGUgZnVuY3Rpb24gcmVzcG9uc2libGUgZm9yIHZlcmlmeWluZyB0aGUgbWVzc2FnZSBpdHNlbGYgYW5kIGNhbGxpbmcgdGhlIHByb3BlciBiYXIgPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5tc2dWZXJpZnkgPSBmdW5jdGlvbiAobXNnSW5mbykge1xyXG5cdGlmIChtc2dJbmZvLmtleUxpc3QubGVuZ3RoID09IDApIHtcclxuXHRcdHZhciBrZXlJZExpc3QgPSBtc2dJbmZvLmNsZWFydGV4dC5nZXRTaWduaW5nS2V5SWRzKCk7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGtleUlkTGlzdC5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHR2YXIgcHVibGljS2V5TGlzdCA9IHRoaXMua2V5cmluZy5nZXRLZXlzRm9yS2V5SWQob3BlbnBncC51dGlsLmhleHN0cmR1bXAoa2V5SWRMaXN0W2ldLndyaXRlKCkpKTtcclxuXHRcdFx0aWYgKHB1YmxpY0tleUxpc3QgIT09IG51bGwgJiYgcHVibGljS2V5TGlzdC5sZW5ndGggPiAwKSB7XHJcblx0XHRcdFx0bXNnSW5mby5rZXlMaXN0ID0gbXNnSW5mby5rZXlMaXN0LmNvbmNhdChwdWJsaWNLZXlMaXN0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIHJlc3VsdCA9IGZhbHNlO1xyXG5cdHZhciBpZCA9IFwiMHhcIiArIG9wZW5wZ3AudXRpbC5oZXhzdHJkdW1wKG1zZ0luZm8ua2V5TGlzdFswXS5nZXRLZXlJZHMoKVswXS53cml0ZSgpKS5zdWJzdHJpbmcoOCk7XHJcblx0dmFyIHVzZXIgPSBtc2dJbmZvLmtleUxpc3RbMF0uZ2V0VXNlcklkcygpWzBdO1xyXG5cclxuXHR2YXIgdmVyaWZ5UmVzdWx0ID0gbXNnSW5mby5jbGVhcnRleHQudmVyaWZ5KG1zZ0luZm8ua2V5TGlzdCk7XHJcblx0aWYgKHZlcmlmeVJlc3VsdCkge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCB2ZXJpZnlSZXN1bHQubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0aWYgKHZlcmlmeVJlc3VsdFtpXS52YWxpZCkge1xyXG5cdFx0XHRcdHJlc3VsdCA9IHRydWU7XHJcblx0XHRcdFx0aWQgPSBcIjB4XCIgKyBvcGVucGdwLnV0aWwuaGV4c3RyZHVtcCh2ZXJpZnlSZXN1bHRbaV0ua2V5aWQud3JpdGUoKSkuc3Vic3RyaW5nKDgpO1xyXG5cdFx0XHRcdHVzZXIgPSBtc2dJbmZvLmtleUxpc3RbaV0uZ2V0VXNlcklkcygpWzBdO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR0aGlzLnJlc3VsdEJhcihtc2dJbmZvLCByZXN1bHQsIGlkLCB1c2VyKTtcclxufTtcclxuXHJcbm9yZ19vcGVuX3N3X3BncC5wcm90b3R5cGUucmVtb3ZlRnJvbVRlbXBDYWNoZSA9IGZ1bmN0aW9uIChtc2dJZCkge1xyXG5cdC8vIElmIHdlIGhhdmUgdGhlIG5lY2Vzc2FyeSBzZXNzaW9uU3RvcmFnZSBvYmplY3RcclxuXHRpZiAodGhpcy5oYXNMb2NhbFN0b3JhZ2UpIHtcclxuXHRcdHNlc3Npb25TdG9yYWdlLnJlbW92ZUl0ZW0obXNnSWQpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQvLyBCeSBkZWZhdWx0IGNvb2tpZXMgYXJlIGFsbCBzZXNzaW9uXHJcblx0XHRkb2N1bWVudC5jb29raWUucmVtb3ZlSXRlbSgnUEdQVmVyaWZpZWRfJyArIG1zZ0lkKTtcclxuXHR9XHJcbn07XHJcblxyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLnN0b3JlSW5UZW1wQ2FjaGUgPSBmdW5jdGlvbiAobXNnSWQsIEhUTUwpIHtcclxuXHQvLyBJZiB3ZSBoYXZlIHRoZSBuZWNlc3Nhcnkgc2Vzc2lvblN0b3JhZ2Ugb2JqZWN0XHJcblx0aWYgKHRoaXMuaGFzTG9jYWxTdG9yYWdlKSB7XHJcblx0XHRzZXNzaW9uU3RvcmFnZS5zZXRJdGVtKG1zZ0lkLCBlc2NhcGUoSFRNTCkpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQvLyBCeSBkZWZhdWx0IGNvb2tpZXMgYXJlIGFsbCBzZXNzaW9uXHJcblx0XHRkb2N1bWVudC5jb29raWUgPSAnUEdQVmVyaWZpZWRfJyArIG1zZ0lkICsnPScrIGVzY2FwZShIVE1MKTtcclxuXHR9XHJcbn07XHJcblxyXG5vcmdfb3Blbl9zd19wZ3AucHJvdG90eXBlLmdldEZyb21UZW1wQ2FjaGUgPSBmdW5jdGlvbiAobXNnSWQpIHtcclxuXHQvLyBJZiB3ZSBoYXZlIHRoZSBuZWNlc3NhcnkgbG9jYWxTdG9yYWdlIG9iamVjdFxyXG5cdGlmICh0aGlzLmhhc0xvY2FsU3RvcmFnZSkge1xyXG5cdFx0bXNnSFRNTCA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0obXNnSWQpO1xyXG5cdFx0aWYgKG1zZ0hUTUwgIT09IG51bGwpIHtcclxuXHRcdFx0bXNnSFRNTCA9IHVuZXNjYXBlKG1zZ0hUTUwpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG1zZ0hUTUw7XHJcblx0fSBlbHNlIHtcclxuXHRcdHZhciBjb29raWVzID0gZG9jdW1lbnQuY29va2llLnNwbGl0KCc7Jyk7ICAgICAgICBcclxuXHRcdHZhciBwZ3BDb29raWVzID0gbmV3IEFycmF5KCk7ICAgICAgIFxyXG5cdFx0Zm9yIChpPTA7aTxjb29raWVzLmxlbmd0aDtpKyspIHsgXHJcblx0XHRcdC8vIFBvcHVsYXRlIG91ciBwZ3BDb29raWVzIGFycmF5IHdpdGggdGhlIHBvaW50ZXJzIHRvIHRoZSBjb29raWVzIHdlIHdhbnRcclxuXHRcdFx0aWYgKGNvb2tpZXNbaV0uaW5kZXhPZignUEdQVmVyaWZpZWRfJykgIT0gLTEpIHtcclxuXHRcdFx0XHRwZ3BDb29raWVzLnB1c2goaSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdC8vIEZvciBlYWNoIFBHUCBjb29raWVcclxuXHRcdGZvciAoaT0wO2k8cGdwQ29va2llcy5sZW5ndGg7aSsrKSB7ICAgICBcclxuXHRcdFx0aWYgKGNvb2tpZXNbcGdwQ29va2llc1tpXV0ucmVwbGFjZSgvXlxccy8sJycpLnNwbGl0KCc9JylbMF0gPT09IFwiUEdQVmVyaWZpZWRfXCIgKyBtc2dJZCkge1xyXG5cdFx0XHRcdC8vIERlbGljaW91cyBjb29raWVzXHJcblx0XHRcdFx0bXNnSFRNTCA9IHVuZXNjYXBlKGNvb2tpZXNbcGdwQ29va2llc1tpXV0ucmVwbGFjZSgvXlxccy8sJycpLnNwbGl0KCc9JylbMV0pO1xyXG5cdFx0XHRcdHJldHVybiBtc2dIVE1MO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9ICAgIFxyXG59O1xyXG5cclxuLypcclxuPT09PT0gVGhlc2UgY2hhbmdlIHRoZSBpbmZvQmFyIHN0dWZmIHRvIHBhc3MvZmFpbCB2ZXJpZmljYXRpb24gPT09PT1cclxuKi9cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5yZXN1bHRCYXIgPSBmdW5jdGlvbiAobXNnSW5mbywgc3VjY2VlZGVkLCBrZXlJZCwgdXNlcikge1xyXG5cdHVzZXIgPSB1c2VyLnJlcGxhY2UoJzwnLCcmbHQ7JykucmVwbGFjZSgnPicsJyZndDsnKTtcclxuXHJcblx0dmFyIHZhbHVlcyA9IHtcclxuXHRcdGxvZ286IHRoaXMuZ2V0UmVzb3VyY2UoJ3BncC5wbmcnKSxcclxuXHRcdGNsYXNzTmFtZTogc3VjY2VlZGVkID8gJ3N1Y2Nlc3MnIDogJ2ZhaWwnLFxyXG5cdFx0aWQ6IGtleUlkLFxyXG5cdFx0dXNlcjogdXNlcixcclxuXHRcdG1zZzogc3VjY2VlZGVkID8gJ3ZlcmlmaWVkIHN1Y2Nlc3NmdWxseSEnIDogJypOT1QqIHZlcmlmaWVkIScsXHJcblx0XHRpbmZvQmFyRGl2SWQ6IG1zZ0luZm8uZGl2SWRcclxuXHR9O1xyXG5cclxuXHR2YXIgaHRtbCA9IEFqeFRlbXBsYXRlLmV4cGFuZChcIm9yZ19vcGVuX3N3X3BncC50ZW1wbGF0ZXMucGdwI2luZm9iYXJfcmVzdWx0XCIsIHZhbHVlcyk7XHJcblx0dmFyIHppbWxldCA9IHRoaXM7XHJcblx0dmFyIGRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1zZ0luZm8uZGl2SWQpO1xyXG5cclxuXHRkaXYuaW5uZXJIVE1MID0gaHRtbDtcclxuXHJcblx0YnV0dG9ucyA9IGRpdi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXNjYXBlQnV0dG9uXCIpO1xyXG5cdGJ1dHRvbnNbMF0ub25jbGljayA9IGZ1bmN0aW9uICgpIHsgemltbGV0LmRlc3Ryb3lJbmZvQmFyKG1zZ0luZm8pOyB9O1xyXG59O1xyXG5cclxub3JnX29wZW5fc3dfcGdwLnByb3RvdHlwZS5fZGlhbG9nQ2xvc2VMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudG9iaikge1xyXG5cdGlmIChldmVudG9iaikge1xyXG5cdFx0ZXZlbnRvYmouaXRlbS5wYXJlbnQucG9wZG93bigpO1xyXG5cdH1cclxufTtcclxuIl19
(1)
});
;