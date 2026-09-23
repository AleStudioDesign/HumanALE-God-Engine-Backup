const STATUS_LABELS={
  idle:'Ready',
  listening:'Listening',
  thinking:'Thinking',
  speaking:'Speaking',
  processing:'Processing',
  error:'Attention'
};

export class DudidamPopup{
  constructor(root,{onAction}={}){
    this.root=root||null;
    this.onAction=typeof onAction==='function'?onAction:()=>{};
    this.collapsed=false;
    this.visible=Boolean(root)&&!root.hidden;
    if(!this.root)return;

    this.status=this.root.querySelector('[data-popup-status]');
    this.message=this.root.querySelector('[data-popup-message]');
    this.toggle=document.querySelector('#assistantPopupToggle');

    this.handleClick=event=>{
      const control=event.target.closest('[data-popup-action]');
      if(!control)return;
      const action=control.dataset.popupAction;
      if(action==='close'){this.hide();return;}
      if(action==='collapse'){this.setCollapsed(!this.collapsed);return;}
      this.onAction(action,control);
    };
    this.handleToggle=()=>this.toggleVisibility();

    this.root.addEventListener('click',this.handleClick);
    this.toggle?.addEventListener('click',this.handleToggle);
  }

  setStatus(state='idle',label=''){
    if(!this.root)return;
    this.root.dataset.state=state;
    if(this.status)this.status.textContent=label||STATUS_LABELS[state]||STATUS_LABELS.idle;
  }

  setMessage(value=''){
    if(this.message&&value)this.message.textContent=value;
  }

  setTheme(theme='dark'){
    if(this.root)this.root.dataset.theme=theme;
  }

  show(){
    if(!this.root)return;
    this.root.hidden=false;
    this.visible=true;
    if(this.toggle)this.toggle.hidden=true;
  }

  hide(){
    if(!this.root)return;
    this.root.hidden=true;
    this.visible=false;
    if(this.toggle)this.toggle.hidden=false;
  }

  toggleVisibility(){this.visible?this.hide():this.show();}

  setCollapsed(value=false){
    if(!this.root)return;
    this.collapsed=Boolean(value);
    this.root.dataset.collapsed=this.collapsed?'true':'false';
    const button=this.root.querySelector('[data-popup-action="collapse"]');
    if(button){
      button.setAttribute('aria-expanded',String(!this.collapsed));
      button.textContent=this.collapsed?'▣':'—';
      button.title=this.collapsed?'Perluas':'Ciutkan';
    }
  }

  destroy(){
    this.root?.removeEventListener('click',this.handleClick);
    this.toggle?.removeEventListener('click',this.handleToggle);
  }
}
