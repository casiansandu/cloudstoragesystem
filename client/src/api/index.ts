import { AuthApi } from './AuthApi';
import { FilesApi } from './FilesApi';
import { FoldersApi } from './FoldersApi';
import { UsersApi } from './UsersApi';

class ApiClient {
  public auth: AuthApi;
  public files: FilesApi;
  public folders: FoldersApi;
  public users: UsersApi;

  constructor() {
    this.auth = new AuthApi();
    this.files = new FilesApi();
    this.folders = new FoldersApi();
    this.users = new UsersApi();
  }
}

export const api = new ApiClient();