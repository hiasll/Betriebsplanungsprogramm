export function teamForm(item:any,today:string){
 const date=item.date||today;
 const f:any={start:'07:30',end:'17:00',morningBreak:true,afternoonBreak:true,resources:[],...item,date,endDate:item.endDate||date};
 f.members=f.members||(item.employee?[{employee:item.employee}]:[]);
 delete f.employee;if(!item.members)delete f.id;
 return f;
}
export function changeTeamDate(form:any,date:string){
 const follow=!form.endDate||form.endDate===form.date||form.endDate<date;
 return {...form,date,...(follow?{endDate:date}:{})};
}
