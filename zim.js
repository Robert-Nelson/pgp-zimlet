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

/*
===== Declare a blank constructor, since we don't need one =====
*/
org_open_sw_pgp = function () {
    util.print_output = function (level, str) {
        var header = "UNKNOWN";
        switch (level) {
            case util.printLevel.error:
                header = "ERROR";
                break;
            case util.printLevel.warning:
                header = "WARNING";
                break;
            case util.printLevel.info:
                header = "INFO";
                break;
            case util.printLevel.debug:
                header = "DEBUG";
                break;
        }
        try {
            console.log(header + ': ' + str);
        } catch (e) {
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
org_open_sw_pgp.prototype.toString = 
function () {
    return "org_open_sw_pgp";
};

/*
===== Init functions (not needed really) =====
*/
org_open_sw_pgp.prototype.init = function () {
    this.hasLocalStorage = typeof(window['localStorage']) == "object";

    openpgp.init();
    openpgp.config.debug = true;
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
    var elemId = view._htmlElId + '__Zimbra-PGP';

    var div = document.getElementById(elemId);

    if (div) {
        var html = this.getFromTempCache(msg.id);

        if (html !== null) {
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
                div.id = view._htmlElId + '__Zimbra-PGP';

                bodyDiv.parentElement.insertBefore(div, bodyDiv);

                div = document.getElementById(div.id);
            }

            var msgInfo = { divId:div.id, mailMsgId: msgId };
            var zimlet = this;
            var html;
            var buttons;

            // Parse out our signature stuff and message text
            msgInfo.openpgpMsg = openpgp.read_message(msgText);

            if (msgInfo.openpgpMsg) {
                var pubkeyAlgo = this.getAlgorithmType(msgInfo.openpgpMsg[0].signature.publicKeyAlgorithm);

                var values = {
                    algo: pubkeyAlgo,
                };

                div.innerHTML = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_verify", values);

                buttons = div.getElementsByClassName("verifyButton");
                buttons[0].onclick = function () { zimlet.searchForKey(msgInfo); };
            } else {
                var values = {
                    className: 'fail',
                    algo: 'unknown',
                    id: 'unknown',
                    user: 'unknown',
                    msg: 'Error parsing message',
                };

                div.innerHTML = AjxTemplate.expand("org_open_sw_pgp.templates.pgp#infobar_result", values);
            }

            buttons = div.getElementsByClassName("escapeButton");
            buttons[0].onclick = function () { zimlet.destroyInfoBar(msgInfo); };
        }
    } else {
        //msg: 'Couldn\'t find message??',
        //debugger;
    }
}

/*
===== Destroys the info bar =====
*/
org_open_sw_pgp.destroyInfoBar = function (msgInfo) {
    document.getElementById(msgInfo.divId).innerHTML = "";
    this.removeFromTempCache(msgInfo.mailMsgId);
};


/*
===== Searches cache for key, if not found, ask about going online =====
*/
org_open_sw_pgp.prototype.searchForKey = function (msgInfo) {
    var signature = msgInfo.openpgpMsg[0].signature;
    var keyList = openpgp.keyring.getPublicKeysForKeyId(signature.getIssuer());
    if (keyList !== null && keyList.length > 0) {
        // If this key is found in the cache
        this.msgVerify(msgInfo, keyList);
    } else {   
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
};

/*
===== This searches the interwebs for a suitable public key =====
*/
org_open_sw_pgp.prototype._searchBtnListener = function (msgInfo, eventobj) {
    eventobj.item.parent.popdown();

    var keyid = msgInfo.openpgpMsg[0].signature.getIssuer();
    var response = AjxRpc.invoke(null, '/service/zimlet/org_open_sw_pgp/lookup.jsp?key=0x'+util.hexstrdump(keyid).substring(8), null, null, true);
    // If we don't have a null response
    if (response.text !== "" && response.txt !== "No email specified") {
        // If the key was found, 
        // Create a new temporary div to populate with our response so we can navigate it easier, and hide it.
        var temp_div = document.createElement('div');
        temp_div.innerHTML = response.text;
        var keytext = temp_div.getElementsByTagName('pre')[0].innerHTML;
        openpgp.keyring.importPublicKey(keytext);
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
    openpgp.keyring.importPublicKey(pgpKey);
    this.msgVerify(msgInfo);
};

/*
===== This is the function responsible for verify the message itself and calling the proper bar =====
*/
org_open_sw_pgp.prototype.msgVerify = function (msgInfo, keys) {
    var signature = msgInfo.openpgpMsg[0].signature;

    if (!keys) {
        keys = openpgp.keyring.getPublicKeysForKeyId(signature.getIssuer());
    }

    var result = false;
    var id = "0x" + util.hexstrdump(keys[0].obj.getKeyId()).substring(8);
    var user = keys[0].obj.userIds[0].text;
    var pubkeyAlgo = this.getAlgorithmType(signature.publicKeyAlgorithm);

    for (var i = 0 ; i < keys.length; i++) {
        if (signature.verify(msgInfo.openpgpMsg[0].text, keys[i])) {
            result = true;
            id = "0x" + util.hexstrdump(keys[i].obj.getKeyId()).substring(8);
            user = keys[i].obj.userIds[0].text;
            break;
        }
    }

    // Successful verification! yay!
    this.resultBar(msgInfo, result, id, user, pubkeyAlgo);
};

/*
===== This is function returns a text version of the public key algorithm =====
*/
org_open_sw_pgp.prototype.getAlgorithmType = function (algorithm) {
    var pubkeyAlgo = "UNKNOWN";

    switch (algorithm) {
        case 1:     // RSA (Encrypt or Sign)
        case 2:     // RSA Encrypt-Only
        case 3:     // RSA Sign-Only
            pubkeyAlgo = "RSA";
            break;
        case 17:    // DSA (Digital Signature Algorithm)
            pubkeyAlgo = "DSA";
            break;
        default:
            break;
    }

    return pubkeyAlgo;
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
org_open_sw_pgp.prototype.resultBar = function (msgInfo, succeeded, keyId, user, type) {
    user = user.replace('<','&lt;').replace('>','&gt;');

    var values = {
        className: succeeded ? 'success' : 'fail',
        algo: type,
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

/*
===== Generic error handler, pass it a message and it displays all scary and everything =====
*/
org_open_sw_pgp.prototype.errDialog = function (msg) {
    dialog = appCtxt.getMsgDialog(); 
    var style = DwtMessageDialog.CRITICAL_STYLE;

    dialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._dialogCloseListener));
    dialog.reset();
    dialog.setMessage(msg, style);
    dialog.popup();
};

org_open_sw_pgp.prototype._dialogCloseListener = function (eventobj) {
    eventobj.item.parent.popdown();
};
