1 REM ************* BOMBER by DAVE TOWN *************
10 REM ************* Initialise *************
20 MODE 1:CLS:INK 0,0:BORDER 0:INK 1,18:INK 2,6:INK 3,4:INK 5,15:INK 6,2:INK 7,24:INK 8,8:INK 9,26:INK 10,10:INK 11,20:INK 12,12:INK 13,16:INK 14,14:INK 15,21
30 SYMBOL AFTER 240:SYMBOL 241,&40,&60,&70,&7F,&7F,&3F,&7,&0:SYMBOL 242,&0,&32,&7A,&FE,&FA,&F2,&E0,&0
40 score=0:hiscore=0:plane$=CHR$(241)+CHR$(242):x=2:y=2:drop=0:a=2:b=2
50 GOSUB 380
60 CLS
70 PEN 2:LOCATE 1,15:INPUT"Skill : 0 (ACE) to 5 (NOVICE) ",skill
80 IF skill<0 OR skill>5 THEN GOTO 70
90 skill=skill+10
100 LOCATE 1,15:PRINT CHR$(18);:LOCATE 1,15:INPUT"Speed 0 (FAST) to 100 (SLOW) ",rate
110 IF rate>100 OR rate<0 GOTO 100
120 REM************** Buildings *****************
130 MODE 0:FOR base=5 TO 15:FOR height=21 TO INT(RND(1)*8+skill) STEP-1:LOCATE base,height:PEN base-2:PRINT CHR$(143)+CHR$(8)+CHR$(11)+CHR$(244);:NEXT:NEXT
140 PLOT 0,20,4:DRAW 640,20,4
150 LOCATE 1,25:PEN 2:PRINT"SCORE";score;:LOCATE 13,25:PRINT"HI";hiscore;
160 REM************** Main Game *****************
170 LOCATE x-1,y:PRINT"   ";
180 PEN 1:LOCATE x,y:PRINT plane$;:PEN 2
190 IF y=21 AND x=15 THEN GOTO 210:ELSE GOTO 260
200 REM************** Landed ********************
210 FOR c=0 TO 1000:NEXT
220 score=score+100-(skill*2):skill=skill-1:x=2:y=2:a=2:b=2:drop=0
230 IF skill<10 THEN skill=10:rate=rate-20
240 IF rate<0 THEN rate=0
250 GOTO 120
260 FOR c=0 TO rate:NEXT
270 x=x+1
280 IF x=18 THEN LOCATE x-1,y:PRINT CHR$(18);:x=2:y=y+1:LOCATE x,y:PEN 1:PRINT plane$;:PEN 2
290 a$=INKEY$:IF a$=" " AND drop=0 THEN drop=1:b=y+2:a=x
300 IF y=21 THEN drop=0
310 IF drop=1 THEN LOCATE a,b:PRINT CHR$(252);:LOCATE a,b-1:PRINT" ";:b=b+1:IF b>21 THEN LOCATE a,b:PRINT" ";:LOCATE a,b-1:PRINT" ";:a=0:b=0:drop=0:SOUND 3,4000,10,12,0,0,10
320 ga=(a-0.5)*32:gb=400-(b*16):bomb=TEST(ga,gb)
330 IF bomb>0 THEN GOTO 530
340 gx=((x+1.5)*32):gy=408-(y*16):crash=TEST(gx,gy)
350 IF crash>0 THEN GOTO 450
360 GOTO 170
370 REM************** Instructions **************
380 LOCATE 1,2:PEN 1:PRINT"You are piloting an aircraft over a  des-erted city and must clear the buildings in order to land and refuel.  Your air- craft moves across  the screen from     left to right.";:PRINT
390 PRINT:PRINT"On reaching the right, the aircraft      returns to the  left A LINE FURTHER     DOWN.You have an unlimited supply of    bombs and you can drop them on the      buildings  below by pressing the        SPACE BAR.";:PRINT
400 PRINT:PRINT"Each time you land, the height of the    buildings or the speed of your aircraft increases.";:PRINT:PRINT:PRINT"ONCE YOU HAVE RELEASED A BOMB, YOU WILL NOT BE ABLE TO RELEASE ANOTHER UNTIL THEFIRST HAS EXPLODED!!!!";
410 PEN 2:LOCATE 1,24:PRINT:PRINT"Press any key to start.";
420 a$=INKEY$:IF a$="" GOTO 420
430 RETURN
440 REM************** Collision ****************
450 LOCATE x-1,y:PRINT CHR$(32)+CHR$(32)+CHR$(32)+CHR$(238)+CHR$(8)+CHR$(188)+CHR$(8);
460 FOR t=1 TO 10:SOUND 7,4000,5,15,0,0,5:PEN t:PRINT CHR$(238)+CHR$(8)+CHR$(188)+CHR$(8)+CHR$(32)+CHR$(8);:FOR tm=0 TO 50:NEXT:NEXT:PEN 2
470 CLS:LOCATE 1,5:PRINT"You scored";score;
480 IF score>hiscore THEN hiscore=score:LOCATE 1,8:PRINT"TOP SCORE!!";
490 score=0:LOCATE 1,12:PRINT"Press R  to restart";
500 a$=INKEY$:IF a$="r" OR a$="R" THEN GOTO 510 ELSE GOTO 500
510 PEN 1:MODE 1:x=2:y=2:a=2:b=2:GOTO 70
520 REM************** Bombed Building **********
530 LOCATE a,b-1:PRINT" "+CHR$(8);:PEN 4:FOR tr=1 TO INT(RND(1)*3)+1:score=score+5:SOUND 3,4000,10,12,0,0,10:LOCATE a,b:FOR t=0 TO 4:PRINT CHR$(238)+CHR$(8)+CHR$(32)+CHR$(8);:NEXT:b=b+1
540 IF b=24 THEN b=b-1
550 NEXT
560 LOCATE 6,25:PRINT score;:drop=0:a=x:b=y:GOTO 170
