import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { RANKS } from '@/common/enums/rank.enum';
import { RoleAssignment, RoleAssignmentSchema } from './role-assignment.schema';

@Schema({
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
})
export class User {
    @Prop({ required: true, unique: true, trim: true, lowercase: true })
    username!: string;

    /**
     * Chỉ lưu mật khẩu đã hash.
     * select: false giúp mặc định không trả password khi find/findOne.
     */
    @Prop({ required: true, select: false })
    password!: string;

    @Prop({ trim: true })
    fullName?: string;

    @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
    email?: string;

    @Prop({ trim: true })
    phone?: string;

    /** Chức vụ hiển thị trên hồ sơ, vd: "Trợ lý". */
    @Prop({ trim: true })
    position?: string;

    /**
     * Cấp bậc hàm, vd: "Đại úy". Khác `position`: cấp bậc đi theo con người,
     * chức vụ đi theo vị trí công tác.
     *
     * Ràng buộc theo danh mục ngay ở tầng schema chứ không chỉ ở DTO: dữ liệu
     * nhập từ Excel cũng đi qua đây.
     */
    @Prop({ trim: true, enum: [...RANKS, '', null] })
    rank?: string;

    /** Đơn vị công tác chính của người dùng. */
    @Prop({ type: Types.ObjectId, ref: 'Department', index: true })
    departmentId?: Types.ObjectId;

    /** Một người có thể kiêm nhiệm nhiều vai trò tại nhiều đơn vị. */
    @Prop({ type: [RoleAssignmentSchema], default: [] })
    roleAssignments!: RoleAssignment[];

    @Prop({ default: true, index: true })
    isActive!: boolean;

    /**
     * Phải đổi mật khẩu trước khi dùng tiếp - bật khi tài khoản còn mật khẩu
     * mặc định. Đang bật thì JwtStrategy chỉ cho gọi vài route tối thiểu (xem
     * PASSWORD_CHANGE_ALLOWED_PATHS); đổi mật khẩu xong tự tắt.
     */
    @Prop({ default: false })
    mustChangePassword!: boolean;

    @Prop({ type: Date, default: null })
    lastLoginAt?: Date | null;

    /**
     * Lần gần nhất mật khẩu chính bị đổi (tự đổi hoặc quản trị đặt lại) - hook
     * pre-save tự ghi. JwtStrategy từ chối mọi access token cấp trước mốc này.
     */
    @Prop({ type: Date, default: null, select: false })
    passwordChangedAt?: Date | null;
}

/** Object user an toàn (không kèm mật khẩu), có thêm virtual id. */
export type SafeUser = Omit<
    User,
    | 'password'
    | 'passwordChangedAt'
> & {
    id: string;
};

/** Document Mongoose kèm các instance method. */
export type UserDocument = HydratedDocument<User> & {
    comparePassword(password: string): Promise<boolean>;
    toSafeObject(): SafeUser;
};

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.methods.comparePassword = async function (
    this: UserDocument,
    password: string,
): Promise<boolean> {
    return bcrypt.compare(password, this.password);
};

UserSchema.methods.toSafeObject = function (this: UserDocument): SafeUser {
    const {
        password,
        passwordChangedAt,
        _id,
        __v,
        ...rest
    } = this.toObject();
    return rest as SafeUser;
};

/** Hash password trước khi lưu nếu field bị thay đổi. */
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
    if (!this.isNew) this.passwordChangedAt = new Date();
});

/** Tìm người dùng theo đơn vị và trạng thái. */
UserSchema.index({ departmentId: 1, isActive: 1 });

/** Tìm người có một vai trò cụ thể trong phạm vi đơn vị. */
UserSchema.index({
    'roleAssignments.roleCode': 1,
    'roleAssignments.scopeDepartmentId': 1,
});