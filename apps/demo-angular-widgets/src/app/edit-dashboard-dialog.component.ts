import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import type { NavItem } from '@anton-gustafsson/snapshot-angular';

@Component({
  selector: 'app-edit-dashboard-dialog',
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Edit dashboard</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width: 100%">
        <mat-label>Label</mat-label>
        <input matInput [(ngModel)]="label" />
      </mat-form-field>
      <mat-form-field appearance="outline" style="width: 100%">
        <mat-label>Description</mat-label>
        <textarea matInput [(ngModel)]="description" rows="3"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button (click)="dialogRef.close({ label, description })">Save</button>
    </mat-dialog-actions>
  `,
})
export class EditDashboardDialogComponent {
  dialogRef = inject(MatDialogRef<EditDashboardDialogComponent>);
  private data = inject<NavItem>(MAT_DIALOG_DATA);

  label = this.data.label;
  description = this.data.description ?? '';
}
