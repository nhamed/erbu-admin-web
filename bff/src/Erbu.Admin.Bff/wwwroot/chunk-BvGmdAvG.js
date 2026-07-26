import {Y as Yt,m as mt}from'./chunk-OtZG5soz.js';import {a as _o,X as Xe,f as fo,j as je}from'./chunk-BAfFwhK-.js';import {aF as Cu,aG as Uo,a8 as ws,g,aR as Ag,b8 as ue,bR as sr,bW as Qw,bg as ot$1,b3 as b,P as PI,aa as Fi,aW as Yw,H as Hi,o as oC,K as KC,T as Tu,$ as $h,b9 as Hd,L as Lh,ba as $d,i as iE,b as iC,f as Au,c as Fh,C as kh,q as ae,bb as At,N as IC,R as gC,X as Md,Y as Nd,W as cC,ae as aC,at as NC,bX as Oh,a0 as uC,d as og}from'./main-CYDSVTKG.js';function X(i,g){if(i&1&&(Hi(0,"mat-option",17),KC(1),Tu()),i&2){let t=g.$implicit;Fh("value",t),iE(),Au(" ",t," ");}}function Y(i,g){if(i&1){let t=gC();Hi(0,"mat-form-field",14)(1,"mat-select",16,0),$h("selectionChange",function(e){Md(t);let s=IC(2);return Nd(s._changePageSize(e.value))}),cC(3,X,2,2,"mat-option",17,aC),Tu(),Hi(5,"div",18),$h("click",function(){Md(t);let e=NC(2);return Nd(e.open())}),Tu()();}if(i&2){let t=IC(2);Fh("appearance",t._formFieldAppearance)("color",t.color),iE(),Fh("value",t.pageSize)("disabled",t.disabled),Oh("aria-labelledby",t._pageSizeLabelId),Fh("panelClass",t.selectConfig.panelClass||"")("disableOptionCentering",t.selectConfig.disableOptionCentering),iE(2),uC(t._displayedPageSizeOptions);}}function tt(i,g){if(i&1&&(Hi(0,"div",15),KC(1),Tu()),i&2){let t=IC(2);iE(),og(t.pageSize);}}function et(i,g){if(i&1&&(Hi(0,"div",3)(1,"div",13),KC(2),Tu(),oC(3,Y,6,7,"mat-form-field",14),oC(4,tt,2,1,"div",15),Tu()),i&2){let t=IC();iE(),kh("id",t._pageSizeLabelId),iE(),Au(" ",t._intl.itemsPerPageLabel," "),iE(),iC(t._displayedPageSizeOptions.length>1?3:-1),iE(),iC(t._displayedPageSizeOptions.length<=1?4:-1);}}function it(i,g){if(i&1){let t=gC();Hi(0,"button",19),$h("click",function(){Md(t);let e=IC();return Nd(e._buttonClicked(0,e._previousButtonsDisabled()))}),Hd(),Hi(1,"svg",8),Lh(2,"path",20),Tu()();}if(i&2){let t=IC();Fh("matTooltip",t._intl.firstPageLabel)("matTooltipDisabled",t._previousButtonsDisabled())("disabled",t._previousButtonsDisabled())("tabindex",t._previousButtonsDisabled()?-1:null),kh("aria-label",t._intl.firstPageLabel);}}function at(i,g){if(i&1){let t=gC();Hi(0,"button",21),$h("click",function(){Md(t);let e=IC();return Nd(e._buttonClicked(e.getNumberOfPages()-1,e._nextButtonsDisabled()))}),Hd(),Hi(1,"svg",8),Lh(2,"path",22),Tu()();}if(i&2){let t=IC();Fh("matTooltip",t._intl.lastPageLabel)("matTooltipDisabled",t._nextButtonsDisabled())("disabled",t._nextButtonsDisabled())("tabindex",t._nextButtonsDisabled()?-1:null),kh("aria-label",t._intl.lastPageLabel);}}var nt=(()=>{class i{changes=new ae;itemsPerPageLabel="Items per page:";nextPageLabel="Next page";previousPageLabel="Previous page";firstPageLabel="First page";lastPageLabel="Last page";getRangeLabel=(t,a,e)=>{if(e==0||a==0)return `0 of ${e}`;e=Math.max(e,0);let s=t*a,S=s<e?Math.min(s+a,e):s+a;return `${s+1} \u2013 ${S} of ${e}`};static \u0275fac=function(a){return new(a||i)};static \u0275prov=At({token:i,factory:i.\u0275fac})}return i})(),ot=50;var rt=new b("MAT_PAGINATOR_DEFAULT_OPTIONS"),st=(()=>{class i{_intl=g(nt);_changeDetectorRef=g(Ag);_formFieldAppearance;_pageSizeLabelId=g(ue).getId("mat-paginator-page-size-label-");_intlChanges;_isInitialized=false;_initializedStream=new sr(1);color;get pageIndex(){return this._pageIndex}set pageIndex(t){this._pageIndex=Math.max(t||0,0),this._changeDetectorRef.markForCheck();}_pageIndex=0;get length(){return this._length}set length(t){this._length=t||0,this._changeDetectorRef.markForCheck();}_length=0;get pageSize(){return this._pageSize}set pageSize(t){this._pageSize=Math.max(t||0,0),this._updateDisplayedPageSizeOptions();}_pageSize;get pageSizeOptions(){return this._pageSizeOptions}set pageSizeOptions(t){this._pageSizeOptions=(t||[]).map(a=>Qw(a,0)),this._updateDisplayedPageSizeOptions();}_pageSizeOptions=[];hidePageSize=false;showFirstLastButtons=false;selectConfig={};disabled=false;page=new ot$1;_displayedPageSizeOptions;initialized=this._initializedStream;constructor(){let t=this._intl,a=g(rt,{optional:true});if(this._intlChanges=t.changes.subscribe(()=>this._changeDetectorRef.markForCheck()),a){let{pageSize:e,pageSizeOptions:s,hidePageSize:S,showFirstLastButtons:C}=a;e!=null&&(this._pageSize=e),s!=null&&(this._pageSizeOptions=s),S!=null&&(this.hidePageSize=S),C!=null&&(this.showFirstLastButtons=C);}this._formFieldAppearance=a?.formFieldAppearance||"outline";}ngOnInit(){this._isInitialized=true,this._updateDisplayedPageSizeOptions(),this._initializedStream.next();}ngOnDestroy(){this._initializedStream.complete(),this._intlChanges.unsubscribe();}nextPage(){this.hasNextPage()&&this._navigate(this.pageIndex+1);}previousPage(){this.hasPreviousPage()&&this._navigate(this.pageIndex-1);}firstPage(){this.hasPreviousPage()&&this._navigate(0);}lastPage(){this.hasNextPage()&&this._navigate(this.getNumberOfPages()-1);}hasPreviousPage(){return this.pageIndex>=1&&this.pageSize!=0}hasNextPage(){let t=this.getNumberOfPages()-1;return this.pageIndex<t&&this.pageSize!=0}getNumberOfPages(){return this.pageSize?Math.ceil(this.length/this.pageSize):0}_changePageSize(t){let a=this.pageIndex*this.pageSize,e=this.pageIndex;this.pageIndex=Math.floor(a/t)||0,this.pageSize=t,this._emitPageEvent(e);}_nextButtonsDisabled(){return this.disabled||!this.hasNextPage()}_previousButtonsDisabled(){return this.disabled||!this.hasPreviousPage()}_updateDisplayedPageSizeOptions(){this._isInitialized&&(this.pageSize||(this._pageSize=this.pageSizeOptions.length!=0?this.pageSizeOptions[0]:ot),this._displayedPageSizeOptions=this.pageSizeOptions.slice(),this._displayedPageSizeOptions.indexOf(this.pageSize)===-1&&this._displayedPageSizeOptions.push(this.pageSize),this._displayedPageSizeOptions.sort((t,a)=>t-a),this._changeDetectorRef.markForCheck());}_emitPageEvent(t){this.page.emit({previousPageIndex:t,pageIndex:this.pageIndex,pageSize:this.pageSize,length:this.length});}_navigate(t){let a=this.pageIndex;t!==a&&(this.pageIndex=t,this._emitPageEvent(a));}_buttonClicked(t,a){a||this._navigate(t);}static \u0275fac=function(a){return new(a||i)};static \u0275cmp=PI({type:i,selectors:[["mat-paginator"]],hostAttrs:["role","group",1,"mat-mdc-paginator"],inputs:{color:"color",pageIndex:[2,"pageIndex","pageIndex",Qw],length:[2,"length","length",Qw],pageSize:[2,"pageSize","pageSize",Qw],pageSizeOptions:"pageSizeOptions",hidePageSize:[2,"hidePageSize","hidePageSize",Yw],showFirstLastButtons:[2,"showFirstLastButtons","showFirstLastButtons",Yw],selectConfig:"selectConfig",disabled:[2,"disabled","disabled",Yw]},outputs:{page:"page"},exportAs:["matPaginator"],decls:14,vars:14,consts:[["selectRef",""],[1,"mat-mdc-paginator-outer-container"],[1,"mat-mdc-paginator-container"],[1,"mat-mdc-paginator-page-size"],[1,"mat-mdc-paginator-range-actions"],["aria-atomic","true","aria-live","polite","role","status",1,"mat-mdc-paginator-range-label"],["matIconButton","","type","button","matTooltipPosition","above","disabledInteractive","",1,"mat-mdc-paginator-navigation-first",3,"matTooltip","matTooltipDisabled","disabled","tabindex"],["matIconButton","","type","button","matTooltipPosition","above","disabledInteractive","",1,"mat-mdc-paginator-navigation-previous",3,"click","matTooltip","matTooltipDisabled","disabled","tabindex"],["viewBox","0 0 24 24","focusable","false","aria-hidden","true",1,"mat-mdc-paginator-icon"],["d","M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"],["matIconButton","","type","button","matTooltipPosition","above","disabledInteractive","",1,"mat-mdc-paginator-navigation-next",3,"click","matTooltip","matTooltipDisabled","disabled","tabindex"],["d","M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"],["matIconButton","","type","button","matTooltipPosition","above","disabledInteractive","",1,"mat-mdc-paginator-navigation-last",3,"matTooltip","matTooltipDisabled","disabled","tabindex"],["aria-hidden","true",1,"mat-mdc-paginator-page-size-label"],[1,"mat-mdc-paginator-page-size-select",3,"appearance","color"],[1,"mat-mdc-paginator-page-size-value"],["hideSingleSelectionIndicator","",3,"selectionChange","value","disabled","aria-labelledby","panelClass","disableOptionCentering"],[3,"value"],[1,"mat-mdc-paginator-touch-target",3,"click"],["matIconButton","","type","button","matTooltipPosition","above","disabledInteractive","",1,"mat-mdc-paginator-navigation-first",3,"click","matTooltip","matTooltipDisabled","disabled","tabindex"],["d","M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"],["matIconButton","","type","button","matTooltipPosition","above","disabledInteractive","",1,"mat-mdc-paginator-navigation-last",3,"click","matTooltip","matTooltipDisabled","disabled","tabindex"],["d","M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"]],template:function(a,e){a&1&&(Hi(0,"div",1)(1,"div",2),oC(2,et,5,4,"div",3),Hi(3,"div",4)(4,"div",5),KC(5),Tu(),oC(6,it,3,5,"button",6),Hi(7,"button",7),$h("click",function(){return e._buttonClicked(e.pageIndex-1,e._previousButtonsDisabled())}),Hd(),Hi(8,"svg",8),Lh(9,"path",9),Tu()(),$d(),Hi(10,"button",10),$h("click",function(){return e._buttonClicked(e.pageIndex+1,e._nextButtonsDisabled())}),Hd(),Hi(11,"svg",8),Lh(12,"path",11),Tu()(),oC(13,at,3,5,"button",12),Tu()()()),a&2&&(iE(2),iC(e.hidePageSize?-1:2),iE(3),Au(" ",e._intl.getRangeLabel(e.pageIndex,e.pageSize,e.length)," "),iE(),iC(e.showFirstLastButtons?6:-1),iE(),Fh("matTooltip",e._intl.previousPageLabel)("matTooltipDisabled",e._previousButtonsDisabled())("disabled",e._previousButtonsDisabled())("tabindex",e._previousButtonsDisabled()?-1:null),kh("aria-label",e._intl.previousPageLabel),iE(3),Fh("matTooltip",e._intl.nextPageLabel)("matTooltipDisabled",e._nextButtonsDisabled())("disabled",e._nextButtonsDisabled())("tabindex",e._nextButtonsDisabled()?-1:null),kh("aria-label",e._intl.nextPageLabel),iE(3),iC(e.showFirstLastButtons?13:-1));},dependencies:[Xe,fo,je,Fi,mt],styles:[`.mat-mdc-paginator {
  display: block;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  color: var(--mat-paginator-container-text-color, var(--mat-sys-on-surface));
  background-color: var(--mat-paginator-container-background-color, var(--mat-sys-surface));
  font-family: var(--mat-paginator-container-text-font, var(--mat-sys-body-small-font));
  line-height: var(--mat-paginator-container-text-line-height, var(--mat-sys-body-small-line-height));
  font-size: var(--mat-paginator-container-text-size, var(--mat-sys-body-small-size));
  font-weight: var(--mat-paginator-container-text-weight, var(--mat-sys-body-small-weight));
  letter-spacing: var(--mat-paginator-container-text-tracking, var(--mat-sys-body-small-tracking));
  --mat-form-field-container-height: var(--mat-paginator-form-field-container-height, 40px);
  --mat-form-field-container-vertical-padding: var(--mat-paginator-form-field-container-vertical-padding, 8px);
}
.mat-mdc-paginator .mat-mdc-select-value {
  font-size: var(--mat-paginator-select-trigger-text-size, var(--mat-sys-body-small-size));
}
.mat-mdc-paginator .mat-mdc-form-field-subscript-wrapper {
  display: none;
}
.mat-mdc-paginator .mat-mdc-select {
  line-height: 1.5;
}

.mat-mdc-paginator-outer-container {
  display: flex;
}

.mat-mdc-paginator-container {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px;
  flex-wrap: wrap;
  width: 100%;
  min-height: var(--mat-paginator-container-size, 56px);
}

.mat-mdc-paginator-page-size {
  display: flex;
  align-items: baseline;
  margin-right: 8px;
}
[dir=rtl] .mat-mdc-paginator-page-size {
  margin-right: 0;
  margin-left: 8px;
}

.mat-mdc-paginator-page-size-label {
  margin: 0 4px;
}

.mat-mdc-paginator-page-size-select {
  margin: 0 4px;
  width: var(--mat-paginator-page-size-select-width, 84px);
}

.mat-mdc-paginator-range-label {
  margin: 0 32px 0 24px;
}

.mat-mdc-paginator-range-actions {
  display: flex;
  align-items: center;
}

.mat-mdc-paginator-icon {
  display: inline-block;
  width: 28px;
  fill: var(--mat-paginator-enabled-icon-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-icon-button[aria-disabled] .mat-mdc-paginator-icon {
  fill: var(--mat-paginator-disabled-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
[dir=rtl] .mat-mdc-paginator-icon {
  transform: rotate(180deg);
}

@media (forced-colors: active) {
  .mat-mdc-icon-button[aria-disabled] .mat-mdc-paginator-icon,
  .mat-mdc-paginator-icon {
    fill: currentColor;
  }
  .mat-mdc-paginator-range-actions .mat-mdc-icon-button {
    outline: solid 1px;
  }
  .mat-mdc-paginator-range-actions .mat-mdc-icon-button[aria-disabled] {
    color: GrayText;
  }
}
.mat-mdc-paginator-touch-target {
  display: var(--mat-paginator-touch-target-display, block);
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--mat-paginator-page-size-select-width, 84px);
  height: var(--mat-paginator-page-size-select-touch-target-height, 48px);
  background-color: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
}
`],encapsulation:2})}return i})(),It=(()=>{class i{static \u0275fac=function(a){return new(a||i)};static \u0275mod=Cu({type:i});static \u0275inj=Uo({imports:[ws,_o,Yt,st]})}return i})();export{It as I,st as s};