import { formatDate } from '@angular/common';
import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { searchFiletypes } from '../hydrus-file-mimes';
import { allSystemPredicates, hashAlgorithms, operatorDefaults, operatorOptions, Operators, Predicate, SystemPredicate, unitDefaults, Units, unitsOptions, Value, valueLabels } from '../hydrus-system-predicates';


@Component({
  selector: 'app-system-predicate-dialog',
  templateUrl: './system-predicate-dialog.component.html',
  styleUrls: ['./system-predicate-dialog.component.scss']
})
export class SystemPredicateDialogComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<SystemPredicateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private data: {predicate: SystemPredicate},
    @Inject(LOCALE_ID) private locale
  ) {

  }

  readonly SystemPredicate = SystemPredicate;
  readonly Value = Value;
  readonly Units = Units;
  readonly Operators = Operators;

  readonly operatorOptions = operatorOptions;
  readonly unitsOptions = unitsOptions;
  readonly hashAlgorithms = hashAlgorithms;
  readonly searchFiletypes = searchFiletypes;
  readonly valueLabels = valueLabels;

  public predicateEnum = this.data.predicate;
  public predicate: Predicate = allSystemPredicates[this.data.predicate];

  predicateForm = new FormGroup({
    value: new FormGroup({
      [this.predicate.value]: this.valueForm()
    }),
    ...(this.predicate.operator ? {operator: new FormControl(operatorDefaults[this.predicate.operator])} : {}),
    ...(this.predicate.operator === Operators.TAG_RELATIONAL ? {tagRelationalOperator: new FormControl('', Validators.required)} : {}),
    ...(this.predicate.units ? {units: new FormControl(unitDefaults[this.predicate.units])} : {})
  });

  ngOnInit(): void {

  }

  valueForm() {
    switch (this.predicate.value) {
      case Value.NATURAL: {
        return new FormControl(0, Validators.required);
      }
      case Value.HASHLIST_WITH_DISTANCE: {
        return new FormGroup({
          hashes: new FormControl('', Validators.required),
          distance: new FormControl(4, Validators.required)
        })
      }
      case Value.HASHLIST_WITH_ALGORITHM: {
        return new FormGroup({
          hashes: new FormControl('', Validators.required),
          algorithm: new FormControl('sha256')
        })
      }
      case Value.FILETYPE_LIST: {
        return new FormControl<string[]>([], Validators.required)
      }
      case Value.DATE_OR_TIME_INTERVAL: {
        return new FormGroup({
          date: new FormControl<Date>(null),
          interval: new FormGroup({
            years: new FormControl(0),
            months: new FormControl(0),
            days: new FormControl(0),
            hours: new FormControl(0),
          }),
        })
      }
      case Value.TIME_SEC_MSEC: {
        return new FormGroup({
          sec: new FormControl(0, Validators.required),
          msec: new FormControl(0, Validators.required)
        })
      }
      case Value.ANY_STRING: {
        return new FormControl('', Validators.required)
      }
      case Value.TIME_INTERVAL: {
        return new FormGroup({
          days: new FormControl(0, Validators.required),
          hours: new FormControl(0, Validators.required),
          min: new FormControl(0, Validators.required),
          sec: new FormControl(0, Validators.required),
        })
      }
      case Value.INTEGER: {
        return new FormControl(0, Validators.required)
      }
      case Value.RATIO: {
        return new FormGroup({
          left: new FormControl(1, Validators.required),
          right: new FormControl(1, Validators.required)
        })
      }
      default: {
        return null
      }
    }
  }



  onNoClick(): void {
    this.dialogRef.close();
  }

  onAddClick(): void {
    const tagRelationalOperator = this.predicateForm.value.tagRelationalOperator;
    const operator = this.predicateForm.value.operator;
    const units = this.predicateForm.value.units;
    const value = this.constructValueString();

    const finalTag = `system:${this.predicate.name} ` + [tagRelationalOperator, operator, value, units].filter(Boolean).join(' ');

    this.dialogRef.close(finalTag)
  }

  constructValueString() {
    const v = this.predicateForm.value.value[this.predicate.value] as any;
    switch (this.predicate.value) {
      case Value.NATURAL: {
        return `${v}`
      }
      case Value.HASHLIST_WITH_DISTANCE: {
        return `${v.hashes} with distance ${v.distance}`
      }
      case Value.HASHLIST_WITH_ALGORITHM: {
        return `${v.hashes} ${v.algorithm}`
      }
      case Value.FILETYPE_LIST: {
        return v.join();
      }
      case Value.DATE_OR_TIME_INTERVAL: {
        if(v.date) {
          return formatDate(v.date, 'yyyy-MM-dd', this.locale);
        } else {
          const {years, months, days, hours} = v.interval;
          if(years === 0 && months === 0 && days === 0 && hours === 0) {
            return `0 hours`
          }
          return `${years ? years + ' years ' : ''}${months ? months + ' months ' : ''}${days ? days + ' days ' : ''}${hours ? hours + ' hours' : ''}`
        }
      }
      case Value.TIME_SEC_MSEC: {
        const {sec, msec} = v;
        if(sec === 0 && msec === 0) {
          return `0 seconds`
        }
        return `${sec ? sec + ' seconds ' : ''}${msec ? msec + ' milliseconds' : ''}`
      }
      case Value.ANY_STRING: {
        return `${v}`
      }
      case Value.TIME_INTERVAL: {
        const {days, hours, min, sec} = v;
        if(days === 0 && hours === 0 && min === 0 && sec === 0) {
          return `0 seconds`
        }
        return `${days ? days + ' days ' : ''}${hours ? hours + ' hours ' : ''}${min ? min + ' minutes ' : ''}${sec ? sec + ' seconds' : ''}`
      }
      case Value.INTEGER: {
        return `${v}`
      }
      case Value.RATIO: {
        return `${v.left}:${v.right}`
      }
      default: {
        return null
      }
    }

  }
}
