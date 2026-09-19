import 'package:extension_google_sign_in_as_googleapis_auth/extension_google_sign_in_as_googleapis_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:googleapis/gmail/v1.dart' as gmail;

class GmailService {
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: [
      gmail.GmailApi.gmailReadonlyScope,
      gmail.GmailApi.gmailComposeScope,
    ],
  );

  gmail.GmailApi? _gmailApi;

  Future<bool> signIn() async {
    final account = await _googleSignIn.signIn();
    if (account == null) return false;

    final authClient = await _googleSignIn.authenticatedClient();
    if (authClient == null) return false;

    _gmailApi = gmail.GmailApi(authClient);
    return true;
  }

  /// Mengambil daftar email terbaru yang belum dibaca
  Future<List<Map<String, String>>> fetchUnreadEmails({int maxResults = 5}) async {
    if (_gmailApi == null) throw StateError("Pengguna belum login ke Gmail.");

    final listResponse = await _gmailApi!.users.messages.list(
      'me',
      q: 'is:unread category:primary',
      maxResults: maxResults,
    );

    final messages = listResponse.messages ?? [];
    List<Map<String, String>> emails = [];

    for (var m in messages) {
      final msg = await _gmailApi!.users.messages.get('me', m.id!, format: 'full');
      final headers = msg.payload?.headers ?? [];

      String subject = headers.firstWhere((h) => h.name == 'Subject', orElse: () => gmail.MessagePartHeader(value: '(Tanpa Judul)')).value ?? '';
      String sender = headers.firstWhere((h) => h.name == 'From', orElse: () => gmail.MessagePartHeader(value: 'Tidak Dikenal')).value ?? '';
      String snippet = msg.snippet ?? '';

      emails.add({
        'id': m.id ?? '',
        'sender': sender,
        'subject': subject,
        'snippet': snippet,
      });
    }
    return emails;
  }
}
