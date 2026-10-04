# Postman Testing Workflow

`postman_collection.json` er request-gulo ekta arekta-r ID-r upor depend kore
(jemon Course Offering banate `courseId`, `facultyId`, `semesterId` lage). Tai
ei order-e test korle prottek request-er ID ager kono request theke save hoye
thake. Order-ta code (service, validation, delete guard) dekhe verify kora.

## Age ja lage

1. Server chalu: `npm run dev` (`http://localhost:5000`). Collection-er
   `baseUrl` = `http://localhost:5000/api/v1`.
2. Postman-e collection-er **Variables** tab-e `superAdminPassword`,
   `facultyPassword`, `studentPassword` (ar email jodi alada hoy) nijer
   `.env`-er seeded account-er real value diye boshao. Demo value dile Login
   `401` dey.
3. Test script-gulo token/ID nijei collection variable-e save kore, tai kono
   ID hate copy korte hobe na.

## Dependency chain

```
Department ─► Faculty ─┐
Department ─► Course  ─┼─► Course Offering ─► Enrollment ─► Result
Semester ──────────────┘
Department + Semester ─► Student (ar Auth → Register)
Semester ─► Payment
```

## Sequential order

| # | Folder → request (ei order-e) | Token | Lage | Save hoy |
|---|---|---|---|---|
| 0 | Misc → Health check | – | – | – |
| 1 | Auth → Login as Admin, Login as Student (Login as Faculty optional, step 5-e overwrite hoy) | – | real password | `adminToken`, `adminRefreshToken`, `studentToken` |
| 2 | Users → Get my profile, Update my profile, List users, **Create an Admin account**, Get user by id, Change user role, Activate/deactivate user | admin | Create-er por `userId` | `userId` |
| 3 | Departments → List, **Create**, Get, Update | admin | – | `departmentId` |
| 4 | Semesters → List, **Create**, Get, Update | admin | – | `semesterId` |
| 5 | Faculties → List, **Create faculty**, **Login as the newly created Faculty**, Get, Update | admin | `departmentId` | `facultyId`, `newFacultyEmail`, `facultyToken` (overwrite) |
| 6 | Students → List, **Create**, Get, Update | admin | `departmentId`, `semesterId` | `studentId` |
| 7 | Courses → List, **Create**, Get, Update | admin | `departmentId` | `courseId` |
| 8 | Course Offerings → List, **Create**, Get, Update, Assign faculty | admin | `courseId`, `facultyId`, `semesterId` | `courseOfferingId` |
| 9 | Enrollments → List, **Enroll**, Get, Update enrollment status | Enroll/List/Get: student. Update status: faculty | `courseOfferingId` | `enrollmentId` |
| 10 | Results → List, **Publish result**, Get, Update | Publish/Update: faculty. List/Get: student | `enrollmentId` | `resultId` |
| 11 | Notices → List, **Create**, Get, Update | admin | – | `noticeId` |
| 12 | Payments → **Initiate payment**, Payment callback, List, Get by id | student (callback public) | `semesterId`, `bkashPaymentId` | `paymentId`, `bkashPaymentId` |
| 13 | Admin → List audit logs, Dashboard stats | admin | – | – |
| 14 | Cleanup: Offering → Notice → Faculty → Student → Course → Semester → Department → User | admin | sob ID | – |

**Bold** request-ta ID save kore. Oi request fail korle porer step-gulo
`{{...}}` ba demo ID diye jabe ar 404/400 dibe.

## Optional request

- **Auth → Register:** `departmentId` ar `semesterId` lage, tai step 4-er por
  chalao (nicher "Sotorko" 5 dekho).
- **Auth → Refresh token, Logout:** `adminRefreshToken` lage (Login as Admin
  theke). Nicher "Sotorko" 2 dekho.
- **Auth → Login with Google:** real Google `idToken` lage, local test-e skip
  kora jay.
- **Users → Upload profile image:** Body tab-e `profileImage` field-e ekta image
  file (max 5 MB) select kore pathao. Cloudinary env lage.

## Sotorko

1. **Faculty token:** Enrollment-er "Update enrollment status" ar Result-er
   "Publish result"/"Update result"-e step 5-er *notun banano* faculty-r token
   lage. Seeded tester faculty-r token dile `403` ashe ("only offerings you
   teach"). Step 5-er por "Login as Faculty" abar chalale `facultyToken`
   overwrite hoye `403` hobe.
2. **Token expiry:** Access token default 15 min-e expire kore
   (`JWT_ACCESS_EXPIRES_IN`). `401 Invalid or expired session` ashle oi role-er
   Login abar chalao. Refresh token single-use, tai Refresh ekbar-i kaj kore
   (collection notun refresh token save kore na). Logout sudhu refresh token
   delete kore, access token-e effect fele na.
3. **Result:** ekbar-i Publish hoy, abar korle `409` (tokhon Update result
   chalao). Publish hole enrollment `COMPLETED` hoy. Ta na hole Cleanup-e
   "Delete course offering" `409` dey (active enrollment ache).
4. **Payments:** `BKASH_*` env na thakle `503` ashe, tai `paymentId` save hoy
   na ar Callback/Get kaj kore na. Semester-e `feeAmount` > 0 lagbe (Create
   semester-e 5000 deya ache). Initiate successful hole payment row toiri hoy,
   ar payment delete-er API nei, tai Cleanup-e "Delete semester" `409` dibe.
   Eta expected.
5. **Register:** Auth folder-er prothome (Collection Runner-er default order-e)
   chalale fail kore, karon tokhon department/semester nei. Step 4-er por
   chalao. Kintu ei student oi department/semester-e bandha thake, tai
   Cleanup-e "Delete semester" ar "Delete department" `409` dibe. Eta avoid
   korte Register-er body-te seeded CSE department ar FALL-2026 semester-er ID
   boshao (`GET /departments` ar `GET /semesters` theke pao; DB reset hole ID
   change hoy).
6. **Collection Runner-e ekbare chalale** Register (age), Payments (bKash na
   thakle) ar Cleanup-er semester/department delete fail dekhabe. Ei tinta
   uporer 4 ar 5 onujayi expected.
