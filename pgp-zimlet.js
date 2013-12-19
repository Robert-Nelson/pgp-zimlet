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
