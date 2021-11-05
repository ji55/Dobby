const { async } = require("@firebase/util");
const { admin, adminauth, auth } = require("./../../firebase/fbconfig");

async function getAllgroups(req, res, next) {
  const groupsRef = admin.collection("groups");
  const groups = await groupsRef.get();

  if (groups.empty) {
    return res.status(401).json({
      message: "생성된 그룹이 없습니다.",
    });
  } else {
    const groupsList = [];
    groups.forEach((doc) => {
      groupsList.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    return res.status(200).json({
      message: "그룹 조회 성공",
      groups: groupsList,
    });
  }
}

async function getPublicgroups(req, res, next) {
  const groupRef = admin.collection("groups").where("private", "==", false);
  const groups = await groupRef.get();

  if (groups.empty) {
    return res.status(401).json({
      message: "생성된 그룹이 없습니다.",
    });
  } else {
    const groupsList = [];
    groups.forEach((doc) => {
      groupsList.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    return res.status(200).json({
      message: "그룹 조회 성공",
      groups: groupsList,
    });
  }
}

async function getGroup(req, res, next) {
  const gid = req.query.gid;
  const groupsRef = admin.collection("groups").doc(gid);
  const group = await groupsRef.get();

  if (!group.empty) {
    res.json({
      group: group.data(),
      msg: "그룹 조회 성공",
    });
  } else {
    return res.status(401).json({
      message: "존재하지 않는 그룹입니다.",
    });
  }
}

async function createGroup(req, res, next) {
  const uid = req.body.uid;
  const time = new Date(+new Date() + 3240 * 10000)
    .toISOString()
    .replace("T", " ")
    .replace(/\..*/, "");

  // group collection에 새로운 그룹 추가
  // group collection의 새로 만든 group document에 gid update
  // group collection 의 group document 에 멤버(자기자신) add
  const groupRef = admin.collection("groups");
  const group = await groupRef.add({
    // name: req.body.name,
    // description: req.body.description,
    // private: req.body.private,
    // password: req.body.password,
    ...req.body,
    createdAt: time,
  });

  groupRef
    .doc(group.id)
    .update({ gid: group.id })
    .then(async () => {
      // 멤버에 생성자 추가
      const user = await admin.collection("users").doc(uid).get();

      const userdata = user.data();

      admin.collection("groups").doc(group.id).collection("members").add({
        gid: group.id,
        uid: userdata.uid,
        name: userdata.name,
        email: userdata.email,
        admin: true,
      });

      groupRef
        .doc(group.id)
        .get()
        .then((doc) => {
          res.json({
            group: doc.data(),
            msg: "그룹 생성 성공",
          });
        });
    });
}

async function updateGroup(req, res, next) {
  const gid = req.body.gid;
  const groupRef = admin.collection("groups").doc(gid);
  const group = await groupRef.get();

  if (group.empty) {
    return res.status(401).json({
      message: "존재하지 않는 그룹입니다.",
    });
  } else {
    await groupRef
      .update({
        description: req.body.description,
        private: req.body.private,
        password: req.body.password,
      })
      .then(() => {
        console.log("Group updated successfully for group: " + gid);
        return res.status(200).json({
          message: "그룹 정보 수정 성공",
        });
      })
      .catch((error) => {
        console.log("Error updating group : ", error);
        return res.status(401).json({
          message: "그룹 정보 수정 실패",
        });
      });
  }
}

async function deleteGroup(req, res, next) {
  const gid = req.body.gid;
  const groupRef = admin.collection("groups").doc(gid);
  const group = await groupRef.get();

  if (group.empty) {
    return res.status(401).json({
      message: "존재하지 않는 그룹입니다.",
    });
  } else {
    const groupMemberRef = admin.collection("groups").doc(gid).collection("members");
    const groupMembers = await groupMemberRef.get();

    const groupCalendarRef = admin.collection("groups").doc(gid).collection("calendars");
    const groupCalendars = await groupCalendarRef.get();

    if (!groupMembers.empty) {
      groupMembers.forEach((doc) => {
        groupMemberRef.doc(doc.id).delete();
      });
    }
    if (!groupCalendars.empty) {
      groupCalendars.forEach((doc) => {
        groupCalendarRef.doc(doc.id).delete();
      });
    }

    await groupRef
      .delete()
      .then(() => {
        console.log("Group deleted successfully for group: " + gid);
        return res.status(200).json({
          message: "그룹 삭제 성공",
        });
      })
      .catch((error) => {
        console.log("Error deleting group : ", error);
        return res.status(401).json({
          message: "그룹 삭제 실패",
        });
      });
  }
}
async function changePrivate(req, res, next) {
  const gid = req.body.gid;
  const groupRef = admin.collection("groups").doc(gid);
  const group = await groupRef.get();

  var private = false;
  if (req.body.private) {
    private = false;
  } else {
    private = true;
  }
  if (group.empty) {
    return res.status(401).json({
      message: "존재하지 않는 그룹입니다.",
    });
  } else {
    await groupRef
      .update({
        private: private,
      })
      .then(() => {
        console.log("Group updated successfully for group: " + gid);
        return res.status(200).json({
          message: "그룹 정보 수정 성공",
        });
      })
      .catch((error) => {
        console.log("Error updating group : ", error);
        return res.status(401).json({
          message: "그룹 정보 수정 실패",
        });
      });
  }
}
async function addMember(req, res, next) {
  const gid = req.body.gid;
  const groupRef = admin.collection("groups").doc(gid);
  const group = await groupRef.get();

  if (group.empty) {
    return res.status(401).json({
      message: "존재하지 않는 그룹입니다.",
    });
  } else {
    const members = new Set(req.body.members);

    try {
      members.forEach(async (data) => {
        const groupmemberRef = await groupRef
          .collection("members")
          .where("email", "==", data)
          .get();

        if (groupmemberRef.empty) {
          const userRef = await admin.collection("users").where("email", "==", data).get();
          const member = userRef.docs[0].data();

          groupRef
            .collection("members")
            .add({
              gid: gid,
              name: member.name,
              email: member.email,
              uid: member.uid,
              admin: false,
            })
            .then(() => {
              console.log("Group Member updated successfully for group: " + gid);
            })
            .catch((error) => {
              console.log("Error Member updating group : ", error);
            });
        } else {
          console.log("User already in group");
        }
      });
    } catch (error) {
      console.log(error);
      res.status(401).json({
        msg: "멤버 추가에 문제가 발생하였습니다.",
      });
    } finally {
      res.json({
        msg: "멤버 업데이트 성공",
      });
    }
  }
}
async function leaveMember(req, res, next) {
  const gid = req.body.gid;
  const groupRef = admin.collection("groups").doc(gid);
  const group = await groupRef.get();

  if (group.empty) {
    return res.status(401).json({
      message: "존재하지 않는 그룹입니다.",
    });
  } else {
    const memberRef = await groupRef
      .collection("members")
      .where("email", "==", req.body.email)
      .get();

    if (memberRef.empty) {
      return res.status(401).json({
        message: "존재하지 않는 멤버입니다.",
      });
    } else {
      const member = memberRef.docs[0].id;
      groupRef
        .collection("members")
        .doc(member)
        .delete()
        .then(() => {
          console.log("Group Member deleted successfully for group: " + gid);
          res.json({
            msg: "멤버 삭제 성공",
          });
        })
        .catch((error) => {
          console.log("Error deleting group : ", error);
          res.json({
            msg: "멤버 삭제 실패",
          });
        });
    }
  }
}

module.exports = {
  getAllgroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  changePrivate,
  addMember,
  getPublicgroups,
  leaveMember,
};
