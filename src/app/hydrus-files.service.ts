import { Injectable } from '@angular/core';
import { HydrusBasicFile, HydrusBasicFileFromAPI, HydrusFile, HydrusFileFromAPI, HydrusFileType, type } from './hydrus-file';
import { Observable, of, forkJoin } from 'rxjs';
import { HydrusApiService } from './hydrus-api.service';
import { map, tap } from 'rxjs/operators';

function chunk<T>(array: T[], size: number): T[][] {
  const chunked = [];
  for (let i = 0; i < array.length; i = i + size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

const QUERY_CHUNK_SIZE = 256;


@Injectable({
  providedIn: 'root'
})
export class HydrusFilesService {

  constructor(private api: HydrusApiService) { }

  private allFiles: Map<number, HydrusBasicFile> = new Map<number, HydrusBasicFile>();

  clearFilesCache(): void {
    this.allFiles.clear();
  }

  getFilesCacheSize(): number {
    return this.allFiles.size;
  }

  private getFileMetadataAPI(fileIds: number[]): Observable<HydrusFileFromAPI[]> {
    return this.api.getFileMetadata(
      {
        file_ids: fileIds,
        only_return_identifiers: false,
        only_return_basic_information: false,
        detailed_url_information: true,
        include_notes: true,
        hide_service_names_tags: false,
      }
    ).pipe(map(val => val.metadata));
  }

  private getFileMetadataHashAPI(fileHashes: string[]): Observable<HydrusFileFromAPI[]> {
    return this.api.getFileMetadata(
      {
        hashes: fileHashes,
        only_return_identifiers: false,
        only_return_basic_information: false,
        detailed_url_information: true,
        include_notes: true,
        hide_service_names_tags: false
      },
      true
    ).pipe(map(val => val.metadata));
  }

  private getBasicFileMetadataAPI(fileIds: number[]): Observable<HydrusBasicFileFromAPI[]> {
    return this.api.getFileMetadata({ file_ids: fileIds, only_return_identifiers: false, only_return_basic_information: true }).pipe(map(val => val.metadata));
  }

  private getBasicFileMetadataHashAPI(fileHashes: string[]): Observable<HydrusBasicFileFromAPI[]> {
    return this.api.getFileMetadata({ hashes: fileHashes, only_return_identifiers: false, only_return_basic_information: true }).pipe(map(val => val.metadata));
  }

  private getFileMetadataAPIChunked(fileIds: number[]): Observable<HydrusBasicFileFromAPI[]> {
    return forkJoin(chunk(fileIds, QUERY_CHUNK_SIZE).map(ids => this.getBasicFileMetadataAPI(ids))).pipe(
      map(files => files.flat())
    );
  }

  private getAndAddMetadata(fileIds: number[]): Observable<HydrusBasicFile[]> {
    if (fileIds.length === 0) { return of([]); }
    return this.getFileMetadataAPIChunked(fileIds).pipe(
      map(v => v.map(i => this.processBasicFileFromAPI(i))),
      tap(v => this.addFilesAndTags(v)));
  }

  private addFilesAndTags(files: HydrusBasicFile[]) {
    files.forEach((file) => {
      this.allFiles.set(file.file_id, file);
    });
  }

  getFileMetadata(fileIds: number[]): Observable<HydrusBasicFile[]> {
    const existingFiles: HydrusBasicFile[] = [];
    const filesToGet: number[] = [];
    for (const id of fileIds) {
      if (this.allFiles.has(id)) {
        existingFiles.push(this.allFiles.get(id));
      } else {
        filesToGet.push(id);
      }
    }
    return forkJoin([of(existingFiles), this.getAndAddMetadata(filesToGet)]).pipe(
      map(([s1, s2]) => [...s1, ...s2]),
      map((files) => {
        return files.sort((a, b) => {
          return fileIds.indexOf(a.file_id) - fileIds.indexOf(b.file_id);
        });
      })
    );
  }

  private processFileFromAPI(file: HydrusFileFromAPI): HydrusFile {
    const importTimes = file.file_services.current
              ? Object.values(file.file_services.current)
                  .filter((x) => !!x.time_imported)
                  .map((x) => x.time_imported)
              : [];

    const firstImportTime =
      importTimes.length > 0 ? new Date(Math.min(...importTimes) * 1000) : undefined;

    return {
      ...file,
      file_url: this.api.getFileURLFromHash(file.hash),
      thumbnail_url: this.api.getThumbnailURLFromHash(file.hash),
      file_type: type(file.mime),
      time_imported: firstImportTime
    }
  }

  private processBasicFileFromAPI(file: HydrusBasicFileFromAPI): HydrusBasicFile {
    return {
      ...file,
      file_url: this.api.getFileURLFromHash(file.hash),
      thumbnail_url: this.api.getThumbnailURLFromHash(file.hash),
      file_type: type(file.mime),
    }
  }

  public getFilesById(fileIds: number[]): Observable<HydrusFile[]> {
    if (fileIds.length === 0) { return of([]); }
    return this.getFileMetadataAPI(fileIds).pipe(
      map(v => v.map(i => this.processFileFromAPI(i))));
  }

  public getBasicFilesById(fileIds: number[]): Observable<HydrusBasicFile[]> {
    if (fileIds.length === 0) { return of([]); }
    return this.getBasicFileMetadataAPI(fileIds).pipe(
      map(v => v.map(i => this.processBasicFileFromAPI(i))));
  }

  public getBasicFilesByHash(fileHashes: string[]): Observable<HydrusBasicFile[]> {
    if (fileHashes.length === 0) { return of([]); }
    return this.getBasicFileMetadataHashAPI(fileHashes).pipe(
      map(v => v.map(i => this.processBasicFileFromAPI(i))));
  }

  public getFilesByHash(fileHashes: string[]) {
    if (fileHashes.length === 0) { return of([]); }
    return this.getFileMetadataHashAPI(fileHashes).pipe(
      map(v => v.map(i => this.processFileFromAPI(i))));
  }

  public getFileById(fileId: number): Observable<HydrusFile> {
    return this.getFilesById([fileId]).pipe(
      map(files => files[0])
    )
  }

  public getFileByHash(fileHash: string): Observable<HydrusFile> {
    return this.getFilesByHash([fileHash]).pipe(
      map(files => files[0])
    )
  }



  public getFileAsFile(file: HydrusBasicFileFromAPI): Observable<File> {
    return this.api.getFileAsBlob(file.hash).pipe(
      map(b => new File([b], file.hash + file.ext, {type: b.type}))
    );
  }

  public getThumbAsBlob(file: HydrusBasicFileFromAPI): Observable<Blob> {
    return this.api.getThumbAsBlob(file.hash)
  }

  public deleteFile(hash: string, reason: string = 'Hydrus Web'){
    return this.api.deleteFiles({hash, reason});
  }

  public undeleteFile(hash: string){
    return this.api.undeleteFiles({hash});
  }

  public archiveFile(hash: string){
    return this.api.archiveFiles({hash});
  }

  public unarchiveFile(hash: string){
    return this.api.unarchiveFiles({hash});
  }

}
