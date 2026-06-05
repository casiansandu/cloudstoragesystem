import { AuthApi } from './AuthApi';
import { FilesApi } from './FilesApi';
import { FoldersApi } from './FoldersApi';

class ApiClient {
  public auth: AuthApi;
  public files: FilesApi;
  public folders: FoldersApi;

  constructor() {
    this.auth = new AuthApi();
    this.files = new FilesApi();
    this.folders = new FoldersApi();
  }
}

export const api = new ApiClient();