'use strict';

var keyring = require('keyring');

describe('Verify clearsign msg', function() {
	var expect = chai.expect;

	var v3_clearsign_msg = '-----BEGIN PGP SIGNED MESSAGE-----\r\n' +
		'Hash: SHA1\r\n' +
		'\r\n' +
		'This is a test message.\r\n' +
		'\r\n' +
		'This paragraph is separated form the next by a line of dashes.\r\n' +
		'\r\n' +
		'- --------------------------------------------------------------------------\r\n' +
		'\r\n' +
		'The next paragraph has a number of blank lines between this one and it.\r\n' +
		'\r\n' +
		'\r\n' +
		'\r\n' +
		'\r\n' +
		'\r\n' +
		'\r\n' +
		'This is the last paragraph.\r\n' +
		'\r\n' +
		'- --\r\n' +
		'\r\n' +
		'Joe Test\r\n' +
		'-----BEGIN PGP SIGNATURE-----\r\n' +
		'Version: GnuPG v1.4.15 (GNU/Linux)\r\n' +
		'\r\n' +
		'iQBVAwUBUp/7GPb2DptCzf9MAQKviQH6A6Pqa63kxWI+atMiaSXz5uifgsBoiOof\r\n' +
		'E3/oVTIGyGTgB7KnwZiFkDMFrUNREJVSQGt6+4nxje8gARcuYpMnWw==\r\n' +
		'=lOCC\r\n' +
		'-----END PGP SIGNATURE-----\r\n';

	var v4_clearsign_msg = '-----BEGIN PGP SIGNED MESSAGE-----\r\n' +
		'Hash: SHA1\r\n' +
		'\r\n' +
		'This is a test message.\r\n' +
		'\r\n' +
		'This paragraph is separated form the next by a line of dashes.\r\n' +
		'\r\n' +
		'- --------------------------------------------------------------------------\r\n' +
		'\r\n' +
		'The next paragraph has a number of blank lines between this one and it.\r\n' +
		'\r\n' +
		'\r\n' +
		'\r\n' +
		'\r\n' +
		'\r\n' +
		'\r\n' +
		'This is the last paragraph.\r\n' +
		'\r\n' +
		'- --\r\n' +
		'\r\n' +
		'Joe Test\r\n' +
		'-----BEGIN PGP SIGNATURE-----\r\n' +
		'Version: GnuPG v1.4.15 (GNU/Linux)\r\n' +
		'\r\n' +
		'iFwEAQECAAYFAlKf5LcACgkQ9vYOm0LN/0ybVwH8CItdDh4kWKVcyUx3Q3hWZnWd\r\n' +
		'zP9CUbIa9uToIPABjV3GOTDM3ZgiP0/SE6Al5vG8hlx+/u2piVojoLovk/4LnA==\r\n' +
		'=i6ew\r\n' +
		'-----END PGP SIGNATURE-----\r\n';

	var pubkey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\n' +
		'Version: OpenPGP.js v.1.20131011\n' +
		'Comment: http://openpgpjs.org\n' +
		'\n' +
		'xk0EUlhMvAEB/2MZtCUOAYvyLFjDp3OBMGn3Ev8FwjzyPbIF0JUw+L7y2XR5\n' +
		'RVGvbK88unV3cU/1tOYdNsXI6pSp/Ztjyv7vbBUAEQEAAc0pV2hpdGVvdXQg\n' +
		'VXNlciA8d2hpdGVvdXQudGVzdEB0LW9ubGluZS5kZT7CXAQQAQgAEAUCUlhM\n' +
		'vQkQ9vYOm0LN/0wAAAW4Af9C+kYW1AvNWmivdtr0M0iYCUjM9DNOQH1fcvXq\n' +
		'IiN602mWrkd8jcEzLsW5IUNzVPLhrFIuKyBDTpLnC07Loce1\n' +
		'=6XMW\n' +
		'-----END PGP PUBLIC KEY BLOCK-----';

	function verify(message, key) {
		var pubKeys = keyring.importKey(key);

		var msg = new ZmMailMsg(message);
		var view = new ZmMailMsgView();

		var zimlet = new org_open_sw_pgp(true, keyring);

		zimlet.init();
		zimlet.onMsgView(msg, null, view);
		
		var div = document.getElementById(view._htmlElId + '__PGP-Zimlet');
		var tables = div.getElementsByTagName('table');
		var messageDivs = div.getElementsByClassName('pgpInfoBarMsg');

		return { result: tables[0].className, msg: messageDivs[0].innerHtml };
	};

	describe('Verify V3 signature', function() {
		it('should work', function(done) {
			verify(v3_clearsign_msg, pubkey);
			done();
		});
	});

	describe('Verify V4 signature', function() {
		it('should work', function(done) {
			verify(v4_clearsign_msg, pubkey);
			done();
		});
    });
});
